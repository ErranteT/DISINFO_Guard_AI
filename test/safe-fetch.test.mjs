import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  controlledFetch,
  MAX_RESPONSE_BYTES,
  nodeRequestTransport,
} from "../lib/safe-fetch/controlled-fetch.ts";
import { SafeFetchError } from "../lib/safe-fetch/errors.ts";
import { prepareMaterial } from "../lib/prepare-material.ts";

const encoder = new TextEncoder();
const resolver = async () => [{ address: "8.8.8.8", family: 4 }];

function response(statusCode, headers = {}, chunks = []) {
  return {
    statusCode,
    headers,
    body: (async function* () { for (const chunk of chunks) yield chunk; })(),
    close() {},
  };
}

function transportFor(routes, seen = []) {
  return async (url, target, timeoutMs) => {
    seen.push({ url: url.toString(), target, timeoutMs });
    const result = routes[url.toString()];
    if (!result) throw new Error("unexpected URL");
    return result;
  };
}

test("prepares 2xx HTML using parse5 and removes excluded elements", async () => {
  const seen = [];
  const transport = transportFor({
    "https://example.com/article": response(200, { "content-type": "text/html; charset=UTF-8" }, [
      encoder.encode("<html><body><h1> Tytuł </h1><script>bad()</script><style>x{}</style><noscript>fallback</noscript><p>Treść   testowa</p></body></html>"),
    ]),
  }, seen);
  const result = await prepareMaterial("https://example.com/article", { resolver, transport });
  assert.deepEqual(result, {
    status: "ready",
    url: "https://example.com/article",
    finalUrl: "https://example.com/article",
    contentType: "text/html",
    text: "Tytuł Treść testowa",
  });
  assert.deepEqual(seen[0].target, { address: "8.8.8.8", family: 4 });
  assert.equal(seen[0].timeoutMs, 10_000);
});

test("prepares and normalizes 2xx plain text", async () => {
  const transport = transportFor({
    "http://example.com/text": response(200, { "content-type": "text/plain" }, [encoder.encode("  Ala\n\tma kota  ")]),
  });
  const result = await prepareMaterial("http://example.com/text", { resolver, transport });
  assert.equal(result.text, "Ala ma kota");
  assert.equal(result.contentType, "text/plain");
});

test("follows a validated redirect and a chain of three redirects", async () => {
  const routes = {
    "https://example.com/start": response(302, { location: "/one" }),
    "https://example.com/one": response(301, { location: "https://second.example/two" }),
    "https://second.example/two": response(307, { location: "/final" }),
    "https://second.example/final": response(200, { "content-type": "text/plain" }, [encoder.encode("done")]),
  };
  const result = await controlledFetch("https://example.com/start", { resolver, transport: transportFor(routes) });
  assert.equal(result.finalUrl, "https://second.example/final");
});

test("rejects a fourth redirect and invalid redirect locations", async () => {
  const chain = {
    "https://example.com/0": response(302, { location: "/1" }),
    "https://example.com/1": response(302, { location: "/2" }),
    "https://example.com/2": response(302, { location: "/3" }),
    "https://example.com/3": response(302, { location: "/4" }),
  };
  await assert.rejects(
    controlledFetch("https://example.com/0", { resolver, transport: transportFor(chain) }),
    (error) => error.code === "TOO_MANY_REDIRECTS",
  );
  await assert.rejects(
    controlledFetch("https://example.com/invalid", {
      resolver,
      transport: transportFor({ "https://example.com/invalid": response(302) }),
    }),
    (error) => error.code === "INVALID_REDIRECT",
  );
  await assert.rejects(
    controlledFetch("https://example.com/malformed", {
      resolver,
      transport: transportFor({
        "https://example.com/malformed": response(302, { location: "http://[" }),
      }),
    }),
    (error) => error.code === "INVALID_REDIRECT",
  );
});

test("rejects unsafe redirect targets before another request", async () => {
  await assert.rejects(
    controlledFetch("https://example.com/start", {
      resolver,
      transport: transportFor({ "https://example.com/start": response(302, { location: "http://127.0.0.1/private" }) }),
    }),
    (error) => error.code === "UNSAFE_TARGET",
  );
});

test("rejects HTTP errors and missing or unsupported content types", async () => {
  for (const [name, result, code] of [
    ["http", response(404), "HTTP_ERROR"],
    ["missing", response(200), "UNSUPPORTED_CONTENT_TYPE"],
    ["json", response(200, { "content-type": "application/json" }), "UNSUPPORTED_CONTENT_TYPE"],
  ]) {
    await assert.rejects(
      controlledFetch(`https://example.com/${name}`, { resolver, transport: transportFor({ [`https://example.com/${name}`]: result }) }),
      (error) => error.code === code,
    );
  }
});

test("rejects unsupported content encoding and charset", async () => {
  for (const [name, headers, code] of [
    ["gzip", { "content-type": "text/plain", "content-encoding": "gzip" }, "UNSUPPORTED_CONTENT_ENCODING"],
    ["latin", { "content-type": "text/html; charset=iso-8859-1" }, "UNSUPPORTED_CHARSET"],
  ]) {
    await assert.rejects(
      controlledFetch(`https://example.com/${name}`, { resolver, transport: transportFor({ [`https://example.com/${name}`]: response(200, headers) }) }),
      (error) => error.code === code,
    );
  }
});

test("enforces declared and streamed response size limits", async () => {
  const oversized = encoder.encode("x".repeat(MAX_RESPONSE_BYTES + 1));
  for (const [name, result] of [
    ["declared", response(200, { "content-type": "text/plain", "content-length": String(MAX_RESPONSE_BYTES + 1) })],
    ["streamed", response(200, { "content-type": "text/plain" }, [oversized])],
  ]) {
    await assert.rejects(
      controlledFetch(`https://example.com/${name}`, { resolver, transport: transportFor({ [`https://example.com/${name}`]: result }) }),
      (error) => error.code === "RESPONSE_TOO_LARGE",
    );
  }
});

test("rejects empty prepared text", async () => {
  await assert.rejects(
    prepareMaterial("https://example.com/empty", {
      resolver,
      transport: transportFor({
        "https://example.com/empty": response(200, { "content-type": "text/html" }, [encoder.encode("<script>only()</script>")]),
      }),
    }),
    (error) => error.code === "EMPTY_CONTENT",
  );
});

test("preserves timeout and maps other transport failures", async () => {
  await assert.rejects(
    controlledFetch("https://example.com/slow", {
      resolver,
      transport: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new SafeFetchError("FETCH_TIMEOUT");
      },
    }),
    (error) => error.code === "FETCH_TIMEOUT",
  );
  await assert.rejects(
    controlledFetch("https://example.com/fail", { resolver, transport: async () => { throw new Error("socket detail"); } }),
    (error) => error.code === "FETCH_FAILED" && !error.message.includes("socket detail"),
  );
});

test("preserves FETCH_TIMEOUT when headers arrive and the response body stalls", async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.flushHeaders();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  let transportResponse;

  try {
    transportResponse = await nodeRequestTransport(
      new URL(`http://safe-fetch.test:${address.port}/stalled-body`),
      { address: "127.0.0.1", family: 4 },
      50,
    );

    await assert.rejects(
      async () => {
        for await (const chunk of transportResponse.body) void chunk;
      },
      (error) => error instanceof SafeFetchError && error.code === "FETCH_TIMEOUT",
    );
  } finally {
    transportResponse?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
