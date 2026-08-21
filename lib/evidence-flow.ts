import type { EvidenceClassification, EvidenceRelation } from "./evidence-analysis.ts";
import type { EvidenceCandidate } from "./evidence-retrieval.ts";
import type { EvidenceSynthesisErrorCode, EvidenceSynthesisResult, OverallPattern } from "./evidence-synthesis.ts";

export type AnalyzedEvidenceCandidate = EvidenceCandidate & EvidenceClassification;

export type EvidenceFlowResult = {
  evidenceCandidates: AnalyzedEvidenceCandidate[];
  synthesis: EvidenceSynthesisResult | null;
  synthesisError: EvidenceSynthesisErrorCode | null;
};

const overallPatterns: OverallPattern[] = [
  "supports_only",
  "contradicts_only",
  "mixed",
  "context_only",
  "no_evidence",
];

export const overallPatternLabels: Record<OverallPattern, string> = {
  supports_only: "Materiały głównie wspierają twierdzenie",
  contradicts_only: "Materiały głównie podważają twierdzenie",
  mixed: "Obraz dowodów jest mieszany",
  context_only: "Brak materiałów bezpośrednio za lub przeciw",
  no_evidence: "Brak materiałów do syntezy",
};

export const synthesisErrorMessages: Record<EvidenceSynthesisErrorCode, string> = {
  invalid_model_output: "Nie udało się poprawnie przygotować podsumowania dowodów.",
  llm_provider_error: "Usługa podsumowania dowodów jest chwilowo niedostępna.",
};

export class EvidenceFlowError extends Error {
  constructor() {
    super("Evidence retrieval or analysis failed.");
    this.name = "EvidenceFlowError";
  }
}

function isEvidenceResponse(value: unknown): value is { candidates: EvidenceCandidate[] } {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { candidates?: unknown }).candidates)) {
    return false;
  }
  return (value as { candidates: unknown[] }).candidates.every((candidate) => (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as { url?: unknown }).url === "string" &&
    (typeof (candidate as { title?: unknown }).title === "string" || (candidate as { title?: unknown }).title === null) &&
    typeof (candidate as { content?: unknown }).content === "string" &&
    (typeof (candidate as { retrievalScore?: unknown }).retrievalScore === "number" ||
      (candidate as { retrievalScore?: unknown }).retrievalScore === null)
  ));
}

function isEvidenceAnalysisResponse(
  value: unknown,
  candidateCount: number,
): value is { classifications: EvidenceClassification[] } {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { classifications?: unknown }).classifications)
  ) return false;

  const classifications = (value as { classifications: unknown[] }).classifications;
  if (classifications.length !== candidateCount) return false;
  const indices = new Set<number>();
  for (const classification of classifications) {
    if (typeof classification !== "object" || classification === null) return false;
    const item = classification as Record<string, unknown>;
    if (
      !Number.isInteger(item.candidateIndex) ||
      Number(item.candidateIndex) < 0 ||
      Number(item.candidateIndex) >= candidateCount ||
      indices.has(Number(item.candidateIndex)) ||
      !["supports", "contradicts", "context", "irrelevant"].includes(String(item.relation)) ||
      typeof item.reason !== "string" ||
      !item.reason.trim() ||
      item.reason.length > 300
    ) return false;
    indices.add(Number(item.candidateIndex));
  }
  return indices.size === candidateCount;
}

function isSynthesisResponse(value: unknown): value is EvidenceSynthesisResult {
  return (
    typeof value === "object" &&
    value !== null &&
    overallPatterns.includes((value as { overallPattern?: OverallPattern }).overallPattern as OverallPattern) &&
    typeof (value as { summary?: unknown }).summary === "string" &&
    Boolean((value as { summary: string }).summary.trim())
  );
}

function synthesisErrorCode(value: unknown): EvidenceSynthesisErrorCode {
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { code?: unknown }).code === "invalid_model_output"
  ) return "invalid_model_output";
  return "llm_provider_error";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new EvidenceFlowError();
  }
}

async function requestSynthesis(
  claim: string,
  evidenceCandidates: AnalyzedEvidenceCandidate[],
  request: typeof fetch,
): Promise<Pick<EvidenceFlowResult, "synthesis" | "synthesisError">> {
  const analyzedEvidence = evidenceCandidates.map(({ content, relation, reason }) => ({
    content,
    relation,
    reason,
  }));

  try {
    const response = await request("/api/evidence/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim, analyzedEvidence }),
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { synthesis: null, synthesisError: "llm_provider_error" };
    }
    if (response.ok && isSynthesisResponse(payload)) {
      return { synthesis: payload, synthesisError: null };
    }
    return { synthesis: null, synthesisError: synthesisErrorCode(payload) };
  } catch {
    return { synthesis: null, synthesisError: "llm_provider_error" };
  }
}

export async function runEvidenceFlow(
  claim: string,
  request: typeof fetch = fetch,
  isActive: () => boolean = () => true,
): Promise<EvidenceFlowResult> {
  const retrievalResponse = await request("/api/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim }),
  });
  const retrievalPayload = await readJson(retrievalResponse);
  if (!isActive()) throw new EvidenceFlowError();
  if (!retrievalResponse.ok || !isEvidenceResponse(retrievalPayload)) throw new EvidenceFlowError();

  const candidates = retrievalPayload.candidates.slice(0, 5);
  if (candidates.length === 0) {
    const synthesisResult = await requestSynthesis(claim, [], request);
    if (!isActive()) throw new EvidenceFlowError();
    return { evidenceCandidates: [], ...synthesisResult };
  }

  const analysisResponse = await request("/api/evidence/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim, candidates }),
  });
  const analysisPayload = await readJson(analysisResponse);
  if (!isActive()) throw new EvidenceFlowError();
  if (!analysisResponse.ok || !isEvidenceAnalysisResponse(analysisPayload, candidates.length)) {
    throw new EvidenceFlowError();
  }

  const classifications = new Map(
    analysisPayload.classifications.map((classification) => [
      classification.candidateIndex,
      classification,
    ]),
  );
  const evidenceCandidates = candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    ...classifications.get(candidateIndex)!,
  }));
  const synthesisResult = await requestSynthesis(claim, evidenceCandidates, request);
  if (!isActive()) throw new EvidenceFlowError();
  return { evidenceCandidates, ...synthesisResult };
}

export function relationLabel(relation: EvidenceRelation): string {
  if (relation === "supports") return "Wspiera";
  if (relation === "contradicts") return "Podważa";
  if (relation === "context") return "Kontekst";
  return "Nieistotny";
}
