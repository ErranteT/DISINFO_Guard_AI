import assert from "node:assert/strict";
import test from "node:test";
import {
  EvidenceFlowError,
  overallPatternLabels,
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
    return response({ overallPattern: "mixed", summary: "Materiały przedstawiają mieszany obraz." });
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
    summary: "Materiały przedstawiają mieszany obraz.",
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
      summary: "Brak przeanalizowanych materiałów do utworzenia syntezy.",
    });
  };

  const result = await runEvidenceFlow("Accepted claim", request);

  assert.deepEqual(calls.map(({ url }) => url), ["/api/evidence", "/api/evidence/synthesize"]);
  assert.deepEqual(calls[1].body, { claim: "Accepted claim", analyzedEvidence: [] });
  assert.equal(result.synthesis.overallPattern, "no_evidence");
});

for (const [code, expectedMessage] of Object.entries({
  invalid_model_output: "Nie udało się poprawnie przygotować podsumowania dowodów.",
  llm_provider_error: "Usługa podsumowania dowodów jest chwilowo niedostępna.",
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
    supports_only: "Materiały głównie wspierają twierdzenie",
    contradicts_only: "Materiały głównie podważają twierdzenie",
    mixed: "Obraz dowodów jest mieszany",
    context_only: "Brak materiałów bezpośrednio za lub przeciw",
    no_evidence: "Brak materiałów do syntezy",
  });
});

test("separate runs return only their own synthesis result", async () => {
  const first = await runEvidenceFlow("First claim", async (url) => (
    url === "/api/evidence"
      ? response({ candidates: [] })
      : response({ overallPattern: "no_evidence", summary: "Pierwsze podsumowanie." })
  ));
  const second = await runEvidenceFlow("Second claim", async (url) => (
    url === "/api/evidence"
      ? response({ candidates: [] })
      : response({ status: "error", code: "llm_provider_error" }, 502)
  ));

  assert.equal(first.synthesis.summary, "Pierwsze podsumowanie.");
  assert.equal(second.synthesis, null);
  assert.equal(second.synthesisError, "llm_provider_error");
});
