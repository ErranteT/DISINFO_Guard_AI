import assert from "node:assert/strict";
import test from "node:test";
import { prepareClaimFlow } from "../lib/claim-flow.ts";
import { acceptClaim, rejectClaim } from "../lib/claim-review.ts";

function prepared(text = "Przygotowany tekst") {
  return {
    status: "ready",
    url: "https://example.com/article",
    finalUrl: "https://example.com/article",
    contentType: "text/plain",
    text,
  };
}

test("claim maps to claim_pending without exposing prepared text", async () => {
  const result = await prepareClaimFlow(
    { url: "https://example.com/article" },
    {
      prepare: async () => prepared("pełny wewnętrzny tekst"),
      complete: async () => ({ status: "claim", claim: "Jedno twierdzenie", reason: null }),
    },
  );
  assert.deepEqual(result, { status: "claim_pending", claim: "Jedno twierdzenie", attempt: 1 });
  assert.equal("text" in result, false);
});

test("no_claim maps immediately to claim_unresolved without attempt", async () => {
  let calls = 0;
  const result = await prepareClaimFlow(
    { url: "https://example.com/article" },
    {
      prepare: async () => prepared(),
      complete: async () => {
        calls += 1;
        return { status: "no_claim", claim: null, reason: "no_checkable_claim" };
      },
    },
  );
  assert.deepEqual(result, { status: "claim_unresolved", reason: "no_checkable_claim" });
  assert.equal("attempt" in result, false);
  assert.equal(calls, 1);
});

test("retry request keeps its attempt and supplies rejected claims to the extractor", async () => {
  let modelRequest;
  const result = await prepareClaimFlow(
    { url: "https://example.com/article", attempt: 2, rejectedClaims: ["Pierwszy claim"] },
    {
      prepare: async () => prepared(),
      complete: async (request) => {
        modelRequest = request;
        return { status: "claim", claim: "Drugi claim", reason: null };
      },
    },
  );
  assert.deepEqual(result, { status: "claim_pending", claim: "Drugi claim", attempt: 2 });
  const data = JSON.parse(modelRequest.messages[1].content);
  assert.deepEqual(data.previously_rejected_claims, ["Pierwszy claim"]);
});

test("each user retry is a new prepare call and therefore a new SAFE FETCH", async () => {
  let prepareCalls = 0;
  const dependencies = {
    prepare: async () => {
      prepareCalls += 1;
      return prepared();
    },
    complete: async (request) => {
      const data = JSON.parse(request.messages[1].content);
      return {
        status: "claim",
        claim: data.previously_rejected_claims.length ? "Drugi claim" : "Pierwszy claim",
        reason: null,
      };
    },
  };
  await prepareClaimFlow({ url: "https://example.com/article" }, dependencies);
  await prepareClaimFlow(
    { url: "https://example.com/article", attempt: 2, rejectedClaims: ["Pierwszy claim"] },
    dependencies,
  );
  assert.equal(prepareCalls, 2);
});

test("validates attempt range and rejects a fourth normal attempt", async () => {
  for (const attempt of [0, 1.5, 4, "2"]) {
    const result = await prepareClaimFlow({ url: "https://example.com", attempt, rejectedClaims: [] });
    assert.equal(result.code, "INVALID_ATTEMPT");
  }
});

test("validates rejected claims against the retry attempt", async () => {
  for (const body of [
    { url: "https://example.com", attempt: 2, rejectedClaims: [] },
    { url: "https://example.com", attempt: 2, rejectedClaims: [""] },
    { url: "https://example.com", attempt: 3, rejectedClaims: ["only one"] },
  ]) {
    const result = await prepareClaimFlow(body);
    assert.equal(result.code, "INVALID_REJECTED_CLAIMS");
  }
});

test("Accept ends Claim Flow with a claim ready for the future run", () => {
  assert.deepEqual(
    acceptClaim({ claim: "Zaakceptowany claim", attempt: 2 }),
    { claim: "Zaakceptowany claim" },
  );
});

test("Reject attempt 1 requests attempt 2 and Reject attempt 2 requests attempt 3", () => {
  const second = rejectClaim({ claim: "Pierwszy", attempt: 1 }, []);
  assert.deepEqual(second, { action: "retry", attempt: 2, rejectedClaims: ["Pierwszy"] });
  const third = rejectClaim({ claim: "Drugi", attempt: 2 }, second.rejectedClaims);
  assert.deepEqual(third, {
    action: "retry",
    attempt: 3,
    rejectedClaims: ["Pierwszy", "Drugi"],
  });
});

test("Reject attempt 3 becomes claim_unresolved and never creates attempt 4", () => {
  assert.deepEqual(
    rejectClaim({ claim: "Trzeci", attempt: 3 }, ["Pierwszy", "Drugi"]),
    { action: "unresolved", reason: "rejected_limit" },
  );
});
