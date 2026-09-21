import assert from "node:assert/strict";
import test from "node:test";
import {
  EvidenceFlowError,
  overallPatternLabels,
  relationLabel,
  runEvidenceFlow,
  synthesisErrorMessages,
} from "../lib/evidence-flow.ts";

function candidate(index = 0) {
  return {
    url: `https://example.com/${index}`,
    title: `Source ${index}`,
    content: `Evidence ${index}`,
    retrievalScore: 0.9 - index / 10,
  };
}

function response(body, status = 200) {
  return Response.json(body, { status });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function applyEvidenceRun(state, runIdRef, request) {
  const runId = ++runIdRef.current;
  const isActive = () => runIdRef.current === runId;
  state.evidenceState = "loading";
  try {
    const result = await runEvidenceFlow("Accepted claim", request, isActive);
    if (!isActive()) return;
    state.evidenceCandidates = result.evidenceCandidates;
    state.synthesis = result.synthesis;
    state.synthesisError = result.synthesisError;
    state.evidenceState = "success";
  } catch {
    if (!isActive()) return;
    state.evidenceState = "error";
  }
}

test("runs retrieval, analysis, and synthesis in order with the minimal synthesis payload", async () => {
  const calls = [];
  const candidates = [candidate(0), candidate(1)];
  const request = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url === "/api/evidence") return response({ candidates });
    if (url === "/api/evidence/analyze") {
      return response({
        classifications: [
          { candidateIndex: 1, relation: "contradicts", reason: "Disputes the claim." },
          { candidateIndex: 0, relation: "supports", reason: "Supports the claim." },
        ],
      });
    }
    return response({ overallPattern: "mixed", summary: "The evidence presents a mixed picture." });
  };

  const result = await runEvidenceFlow("Accepted claim", request);

  assert.deepEqual(calls.map(({ url }) => url), [
    "/api/evidence",
    "/api/evidence/analyze",
    "/api/evidence/synthesize",
  ]);
  assert.deepEqual(calls[2].body, {
    claim: "Accepted claim",
    analyzedEvidence: [
      { content: "Evidence 0", relation: "supports", reason: "Supports the claim." },
      { content: "Evidence 1", relation: "contradicts", reason: "Disputes the claim." },
    ],
  });
  assert.ok(!JSON.stringify(calls[2].body).includes("retrievalScore"));
  assert.ok(!JSON.stringify(calls[2].body).includes("title"));
  assert.ok(!JSON.stringify(calls[2].body).includes("url"));
  assert.equal(result.evidenceCandidates[0].relation, "supports");
  assert.deepEqual(result.synthesis, {
    overallPattern: "mixed",
    summary: "The evidence presents a mixed picture.",
  });
  assert.equal(result.synthesisError, null);
});

test("skips analysis for empty candidates and uses the synthesis endpoint as source of no_evidence", async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url === "/api/evidence") return response({ candidates: [] });
    return response({
      overallPattern: "no_evidence",
      summary: "There is no analysed evidence available to summarise.",
    });
  };

  const result = await runEvidenceFlow("Accepted claim", request);

  assert.deepEqual(calls.map(({ url }) => url), ["/api/evidence", "/api/evidence/synthesize"]);
  assert.deepEqual(calls[1].body, { claim: "Accepted claim", analyzedEvidence: [] });
  assert.equal(result.synthesis.overallPattern, "no_evidence");
});

for (const [code, expectedMessage] of Object.entries({
  invalid_model_output: "We couldn't prepare the evidence summary correctly.",
  llm_provider_error: "The evidence summary service is temporarily unavailable.",
})) {
  test(`${code} preserves analyzed evidence and does not retry synthesis`, async () => {
    let synthesisCalls = 0;
    const request = async (url) => {
      if (url === "/api/evidence") return response({ candidates: [candidate()] });
      if (url === "/api/evidence/analyze") {
        return response({
          classifications: [{ candidateIndex: 0, relation: "context", reason: "Adds context." }],
        });
      }
      synthesisCalls += 1;
      return response({ status: "error", code, message: "Backend detail" }, 502);
    };

    const result = await runEvidenceFlow("Accepted claim", request);

    assert.equal(synthesisCalls, 1);
    assert.equal(result.evidenceCandidates.length, 1);
    assert.equal(result.evidenceCandidates[0].reason, "Adds context.");
    assert.equal(result.synthesis, null);
    assert.equal(result.synthesisError, code);
    assert.equal(synthesisErrorMessages[code], expectedMessage);
  });
}

test("does not call synthesis after retrieval or analysis failure", async () => {
  for (const failingStep of ["retrieval", "analysis"]) {
    const calls = [];
    const request = async (url) => {
      calls.push(url);
      if (url === "/api/evidence") {
        return failingStep === "retrieval"
          ? response({ status: "error" }, 502)
          : response({ candidates: [candidate()] });
      }
      return response({ status: "error" }, 502);
    };

    await assert.rejects(
      runEvidenceFlow("Accepted claim", request),
      (error) => error instanceof EvidenceFlowError,
    );
    assert.ok(!calls.includes("/api/evidence/synthesize"));
  }
});

test("maps all backend overall patterns to the approved UI labels", () => {
  assert.deepEqual(overallPatternLabels, {
    supports_only: "Supporting evidence",
    contradicts_only: "Contradicting evidence",
    mixed: "Mixed evidence",
    context_only: "Contextual evidence",
    no_evidence: "No relevant evidence",
  });
});

test("maps all evidence relations to the approved UI labels", () => {
  assert.equal(relationLabel("supports"), "Supports");
  assert.equal(relationLabel("contradicts"), "Contradicts");
  assert.equal(relationLabel("context"), "Provides context");
  assert.equal(relationLabel("irrelevant"), "Irrelevant");
});

test("separate runs return only their own synthesis result", async () => {
  const first = await runEvidenceFlow("First claim", async (url) => (
    url === "/api/evidence"
      ? response({ candidates: [] })
      : response({ overallPattern: "no_evidence", summary: "First summary." })
  ));
  const second = await runEvidenceFlow("Second claim", async (url) => (
    url === "/api/evidence"
      ? response({ candidates: [] })
      : response({ status: "error", code: "llm_provider_error" }, 502)
  ));

  assert.equal(first.synthesis.summary, "First summary.");
  assert.equal(second.synthesis, null);
  assert.equal(second.synthesisError, "llm_provider_error");
});

test("an invalidated run ignores a late success and does not continue after retrieval", async () => {
  const retrieval = deferred();
  const calls = [];
  const state = {
    evidenceState: "idle",
    evidenceCandidates: [],
    synthesis: null,
    synthesisError: null,
  };
  const runIdRef = { current: 0 };
  const running = applyEvidenceRun(state, runIdRef, async (url) => {
    calls.push(url);
    return retrieval.promise;
  });

  runIdRef.current += 1;
  Object.assign(state, {
    evidenceState: "loading",
    evidenceCandidates: [{ marker: "new run" }],
    synthesis: { marker: "new run" },
    synthesisError: "invalid_model_output",
  });
  retrieval.resolve(response({ candidates: [candidate()] }));
  await running;

  assert.deepEqual(calls, ["/api/evidence"]);
  assert.deepEqual(state, {
    evidenceState: "loading",
    evidenceCandidates: [{ marker: "new run" }],
    synthesis: { marker: "new run" },
    synthesisError: "invalid_model_output",
  });
});

test("an invalidated run ignores a late error without ending the active loading state", async () => {
  const retrieval = deferred();
  const state = {
    evidenceState: "idle",
    evidenceCandidates: [],
    synthesis: null,
    synthesisError: null,
  };
  const runIdRef = { current: 0 };
  const running = applyEvidenceRun(state, runIdRef, () => retrieval.promise);

  runIdRef.current += 1;
  Object.assign(state, {
    evidenceState: "loading",
    evidenceCandidates: [{ marker: "new run" }],
    synthesis: { marker: "new run" },
    synthesisError: null,
  });
  retrieval.reject(new Error("late retrieval failure"));
  await running;

  assert.deepEqual(state, {
    evidenceState: "loading",
    evidenceCandidates: [{ marker: "new run" }],
    synthesis: { marker: "new run" },
    synthesisError: null,
  });
});

test("an invalidated run does not start synthesis after analysis resolves", async () => {
  const analysis = deferred();
  const analysisStarted = deferred();
  const calls = [];
  let active = true;
  const running = runEvidenceFlow(
    "Accepted claim",
    async (url) => {
      calls.push(url);
      if (url === "/api/evidence") return response({ candidates: [candidate()] });
      if (url === "/api/evidence/analyze") {
        analysisStarted.resolve();
        return analysis.promise;
      }
      throw new Error("stale synthesis must not start");
    },
    () => active,
  );

  await analysisStarted.promise;
  active = false;
  analysis.resolve(response({
    classifications: [{ candidateIndex: 0, relation: "context", reason: "Adds context." }],
  }));

  await assert.rejects(running, (error) => error instanceof EvidenceFlowError);
  assert.deepEqual(calls, ["/api/evidence", "/api/evidence/analyze"]);
});
