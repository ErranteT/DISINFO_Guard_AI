import assert from "node:assert/strict";
import test from "node:test";
import {
  EvidenceRetrievalError,
  createTavilySearchRequest,
  normalizeTavilyResponse,
  requestTavilySearch,
  retrieveEvidence,
  validateEvidenceClaim,
} from "../lib/evidence-retrieval.ts";

test("normalizes Tavily results to evidence candidates and limits them to five", () => {
  const results = Array.from({ length: 6 }, (_, index) => ({
    url: `https://example.com/${index}`,
    title: ` Result ${index} `,
    content: ` Content ${index} `,
    score: 0.9 - index / 10,
    raw_content: "must not be copied",
  }));

  const candidates = normalizeTavilyResponse({ results });
  assert.equal(candidates.length, 5);
  assert.deepEqual(candidates[0], {
    url: "https://example.com/0",
    title: "Result 0",
    content: "Content 0",
    retrievalScore: 0.9,
  });
  assert.deepEqual(Object.keys(candidates[0]), ["url", "title", "content", "retrievalScore"]);
});

test("omits results without a valid URL", () => {
  const candidates = normalizeTavilyResponse({
    results: [
      { title: "Missing", content: "Useful", score: 0.8 },
      { url: "not a URL", title: "Invalid", content: "Useful", score: 0.7 },
      { url: "https://example.com/valid", title: "Valid", content: "Useful", score: 0.6 },
    ],
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, "https://example.com/valid");
});

test("omits results without useful content", () => {
  const candidates = normalizeTavilyResponse({
    results: [
      { url: "https://example.com/missing", title: "Missing" },
      { url: "https://example.com/blank", title: "Blank", content: "   " },
      { url: "https://example.com/valid", title: "Valid", content: "Useful" },
    ],
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].content, "Useful");
});

test("maps missing title and score to null", () => {
  assert.deepEqual(
    normalizeTavilyResponse({ results: [{ url: "https://example.com", content: "Useful" }] }),
    [{ url: "https://example.com", title: null, content: "Useful", retrievalScore: null }],
  );
});

test("an empty provider result is a successful empty candidate list", async () => {
  const result = await retrieveEvidence(
    { claim: "Accepted claim" },
    { apiKey: "test-only", fetch: async () => Response.json({ results: [] }) },
  );
  assert.deepEqual(result, { candidates: [] });
});

test("provider errors never become an empty candidate list", async () => {
  await assert.rejects(
    retrieveEvidence(
      { claim: "Accepted claim" },
      { apiKey: "test-only", fetch: async () => new Response("failure", { status: 500 }) },
    ),
    (error) => error instanceof EvidenceRetrievalError && error.code === "EVIDENCE_PROVIDER_ERROR",
  );
  await assert.rejects(
    requestTavilySearch(createTavilySearchRequest("Accepted claim"), {
      apiKey: "test-only",
      fetch: async () => Response.json({ unexpected: [] }),
    }).then(normalizeTavilyResponse),
    (error) => error.code === "EVIDENCE_INVALID_RESPONSE",
  );
});

test("validates missing, empty, and non-string claims", () => {
  assert.equal(validateEvidenceClaim({}).code, "CLAIM_REQUIRED");
  assert.equal(validateEvidenceClaim({ claim: "   " }).code, "CLAIM_REQUIRED");
  assert.equal(validateEvidenceClaim({ claim: 42 }).code, "INVALID_CLAIM");
  assert.deepEqual(validateEvidenceClaim({ claim: "  Accepted claim  " }), {
    ok: true,
    claim: "Accepted claim",
  });
});

test("uses only the accepted claim and the fixed Tavily Search parameters", async () => {
  let seenUrl;
  let seenInit;
  await retrieveEvidence(
    { claim: "  Accepted claim  ", ignored: "source text" },
    {
      apiKey: "test-only",
      fetch: async (url, init) => {
        seenUrl = url;
        seenInit = init;
        return Response.json({ results: [] });
      },
    },
  );
  assert.equal(seenUrl, "https://api.tavily.com/search");
  assert.equal(seenInit.method, "POST");
  assert.equal(seenInit.headers.Authorization, "Bearer test-only");
  assert.deepEqual(JSON.parse(seenInit.body), {
    query: "Accepted claim",
    search_depth: "basic",
    max_results: 5,
    topic: "general",
    include_answer: false,
    include_raw_content: false,
    include_images: false,
  });
});
