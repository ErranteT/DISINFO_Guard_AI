import assert from "node:assert/strict";
import test from "node:test";
import { validatePrepareUrl } from "../lib/validate-prepare-url.ts";

function invalidCode(value) {
  const result = validatePrepareUrl(value);
  assert.equal(result.ok, false);
  return result.code;
}

test("accepts HTTP and HTTPS URLs", () => {
  assert.deepEqual(validatePrepareUrl("https://example.com/article"), { ok: true, url: "https://example.com/article" });
  assert.deepEqual(validatePrepareUrl("http://example.com/article"), { ok: true, url: "http://example.com/article" });
});

test("requires a non-empty URL string", () => {
  assert.equal(invalidCode(undefined), "URL_REQUIRED");
  assert.equal(invalidCode("   "), "URL_REQUIRED");
  assert.equal(invalidCode(42), "INVALID_URL");
});

test("rejects malformed URLs and URLs without a protocol", () => {
  assert.equal(invalidCode("not a URL"), "INVALID_URL");
  assert.equal(invalidCode("example.com/article"), "INVALID_URL");
});

test("rejects unsupported protocols", () => {
  assert.equal(invalidCode("ftp://example.com/file"), "UNSUPPORTED_PROTOCOL");
});

test("rejects local hosts and loopback addresses", () => {
  for (const url of [
    "http://localhost:3000",
    "https://api.localhost/path",
    "http://127.0.0.1:8080",
    "https://127.42.10.5/path",
    "http://[::1]/",
  ]) {
    assert.equal(invalidCode(url), "LOCAL_URL_NOT_ALLOWED");
  }
});
