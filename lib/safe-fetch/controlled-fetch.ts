import http, { type IncomingHttpHeaders, type IncomingMessage, type RequestOptions } from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { SafeFetchError } from "./errors.ts";
import { resolveSafeTarget, type ResolveHostname, type ResolvedAddress } from "./target-safety.ts";
import { validatePrepareUrl } from "../validate-prepare-url.ts";

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 3;

export type TransportResponse = {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Uint8Array>;
  close: () => void;
};

export type RequestTransport = (
  url: URL,
  target: ResolvedAddress,
  timeoutMs: number,
) => Promise<TransportResponse>;

function pinnedLookup(target: ResolvedAddress): LookupFunction {
  return ((_hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
    const wantsAll = typeof options === "object" && options !== null && "all" in options && options.all === true;
    if (wantsAll) callback(null, [target]);
    else callback(null, target.address, target.family);
  }) as LookupFunction;
}

export const nodeRequestTransport: RequestTransport = (url, target, timeoutMs) =>
  new Promise((resolve, reject) => {
    const requestFn = url.protocol === "https:" ? https.request : http.request;
    let settled = false;
    let activeResponse: IncomingMessage | undefined;
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ""),
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Accept: "text/html, text/plain",
        "Accept-Encoding": "identity",
        "User-Agent": "DISINFO-Guard-AI/0.1",
      },
      lookup: pinnedLookup(target),
    };
    const request = requestFn(options, (response) => {
      activeResponse = response;
      settled = true;
      resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: response,
        close: () => {
          clearTimeout(timer);
          response.destroy();
        },
      });
    });
    const timer = setTimeout(() => {
      const error = new SafeFetchError("FETCH_TIMEOUT");
      if (activeResponse) activeResponse.destroy(error);
      else request.destroy(error);
    }, timeoutMs);
    request.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) reject(error);
    });
    request.end();
  });

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseContentType(value: string | undefined): "text/html" | "text/plain" {
  if (!value) throw new SafeFetchError("UNSUPPORTED_CONTENT_TYPE");
  const [mime, ...parameters] = value.split(";").map((part) => part.trim().toLowerCase());
  if (mime !== "text/html" && mime !== "text/plain") {
    throw new SafeFetchError("UNSUPPORTED_CONTENT_TYPE");
  }
  const charset = parameters
    .map((part) => part.match(/^charset\s*=\s*["']?([^"']+)["']?$/i)?.[1]?.trim())
    .find(Boolean);
  if (charset && charset !== "utf-8" && charset !== "utf8") {
    throw new SafeFetchError("UNSUPPORTED_CHARSET");
  }
  return mime;
}

async function readLimitedBody(response: TransportResponse): Promise<Uint8Array> {
  const declaredLength = singleHeader(response.headers["content-length"]);
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new SafeFetchError("RESPONSE_TOO_LARGE");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new SafeFetchError("RESPONSE_TOO_LARGE");
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    throw new SafeFetchError("FETCH_FAILED");
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export type ControlledFetchResult = {
  finalUrl: string;
  contentType: "text/html" | "text/plain";
  body: Uint8Array;
};

export type ControlledFetchDependencies = {
  resolver?: ResolveHostname;
  transport?: RequestTransport;
};

export async function controlledFetch(
  initialUrl: string,
  dependencies: ControlledFetchDependencies = {},
): Promise<ControlledFetchResult> {
  const resolver = dependencies.resolver;
  const transport = dependencies.transport ?? nodeRequestTransport;
  let currentUrl = new URL(initialUrl);
  let redirects = 0;

  while (true) {
    const target = await resolveSafeTarget(currentUrl, resolver);
    let response: TransportResponse;
    try {
      response = await transport(currentUrl, target, FETCH_TIMEOUT_MS);
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError("FETCH_FAILED");
    }

    try {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (redirects >= MAX_REDIRECTS) throw new SafeFetchError("TOO_MANY_REDIRECTS");
        const location = singleHeader(response.headers.location);
        if (!location) throw new SafeFetchError("INVALID_REDIRECT");
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, currentUrl);
        } catch {
          throw new SafeFetchError("INVALID_REDIRECT");
        }
        const validation = validatePrepareUrl(redirectUrl.toString());
        if (!validation.ok) {
          if (validation.code === "LOCAL_URL_NOT_ALLOWED") throw new SafeFetchError("UNSAFE_TARGET");
          throw new SafeFetchError("INVALID_REDIRECT");
        }
        currentUrl = new URL(validation.url);
        redirects += 1;
        continue;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new SafeFetchError("HTTP_ERROR");
      }
      const encoding = singleHeader(response.headers["content-encoding"])?.trim().toLowerCase();
      if (encoding && encoding !== "identity") {
        throw new SafeFetchError("UNSUPPORTED_CONTENT_ENCODING");
      }
      const contentType = parseContentType(singleHeader(response.headers["content-type"]));
      const body = await readLimitedBody(response);
      return { finalUrl: currentUrl.toString(), contentType, body };
    } finally {
      response.close();
    }
  }
}
