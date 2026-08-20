import assert from "node:assert/strict";
import test from "node:test";
import { isPublicIp, resolveSafeTarget } from "../lib/safe-fetch/target-safety.ts";

test("allows public IPv4 and IPv6 addresses", () => {
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

test("blocks non-public IPv4 ranges", () => {
  for (const address of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "169.254.10.20", "0.0.0.0", "224.0.0.1",
  ]) assert.equal(isPublicIp(address), false, address);
});

test("blocks non-public IPv6 and private IPv4-mapped IPv6", () => {
  for (const address of ["::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPublicIp(address), false, address);
  }
});

test("applies IP safety directly to literals without DNS", async () => {
  const resolverMustNotRun = async () => { throw new Error("literal must not use DNS"); };
  await assert.rejects(
    resolveSafeTarget(new URL("http://10.0.0.1/private"), resolverMustNotRun),
    (error) => error.code === "UNSAFE_TARGET",
  );
  assert.deepEqual(
    await resolveSafeTarget(new URL("https://8.8.8.8/"), resolverMustNotRun),
    { address: "8.8.8.8", family: 4 },
  );
});

test("fails closed when DNS contains a public and unsafe address", async () => {
  await assert.rejects(
    resolveSafeTarget(new URL("https://example.com"), async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
    (error) => error.code === "UNSAFE_TARGET",
  );
});

test("reports DNS resolution failures and empty answers", async () => {
  await assert.rejects(
    resolveSafeTarget(new URL("https://example.com"), async () => { throw new Error("dns"); }),
    (error) => error.code === "DNS_RESOLUTION_FAILED",
  );
  await assert.rejects(
    resolveSafeTarget(new URL("https://example.com"), async () => []),
    (error) => error.code === "DNS_RESOLUTION_FAILED",
  );
});
