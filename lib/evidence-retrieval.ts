export const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
export const TAVILY_TIMEOUT_MS = 15_000;

export type EvidenceCandidate = {
  url: string;
  title: string | null;
  content: string;
  retrievalScore: number | null;
};

export type TavilySearchRequest = {
  query: string;
  search_depth: "basic";
  max_results: 5;
  topic: "general";
  include_answer: false;
  include_raw_content: false;
  include_images: false;
};

export type EvidenceInputFailure = {
  ok: false;
  code: "CLAIM_REQUIRED" | "INVALID_CLAIM";
  message: string;
};

export type EvidenceRetrievalErrorCode =
  | "EVIDENCE_CONFIGURATION_ERROR"
  | "EVIDENCE_PROVIDER_TIMEOUT"
  | "EVIDENCE_AUTH_ERROR"
  | "EVIDENCE_RATE_LIMITED"
  | "EVIDENCE_PROVIDER_ERROR"
  | "EVIDENCE_INVALID_RESPONSE";

const errorMessages: Record<EvidenceRetrievalErrorCode, string> = {
  EVIDENCE_CONFIGURATION_ERROR: "The evidence search service is not configured.",
  EVIDENCE_PROVIDER_TIMEOUT: "The evidence search timed out.",
  EVIDENCE_AUTH_ERROR: "The evidence search service rejected authentication.",
  EVIDENCE_RATE_LIMITED: "The evidence search service is temporarily overloaded.",
  EVIDENCE_PROVIDER_ERROR: "The evidence search service returned an error.",
  EVIDENCE_INVALID_RESPONSE: "The evidence search service returned an invalid response.",
};

export class EvidenceRetrievalError extends Error {
  readonly code: EvidenceRetrievalErrorCode;

  constructor(code: EvidenceRetrievalErrorCode) {
    super(errorMessages[code]);
    this.name = "EvidenceRetrievalError";
    this.code = code;
  }
}

export function validateEvidenceClaim(body: unknown):
  | { ok: true; claim: string }
  | EvidenceInputFailure {
  if (typeof body !== "object" || body === null || Array.isArray(body) || !("claim" in body)) {
    return { ok: false, code: "CLAIM_REQUIRED", message: "A claim is required." };
  }

  const claim = (body as Record<string, unknown>).claim;
  if (typeof claim !== "string") {
    return { ok: false, code: "INVALID_CLAIM", message: "The claim must be text." };
  }

  const trimmedClaim = claim.trim();
  if (!trimmedClaim) {
    return { ok: false, code: "CLAIM_REQUIRED", message: "A claim is required." };
  }

  return { ok: true, claim: trimmedClaim };
}

export function createTavilySearchRequest(claim: string): TavilySearchRequest {
  return {
    query: claim,
    search_depth: "basic",
    max_results: 5,
    topic: "general",
    include_answer: false,
    include_raw_content: false,
    include_images: false,
  };
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmedUrl = value.trim();
  try {
    const url = new URL(trimmedUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmedUrl : null;
  } catch {
    return null;
  }
}

export function normalizeTavilyResponse(value: unknown): EvidenceCandidate[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EvidenceRetrievalError("EVIDENCE_INVALID_RESPONSE");
  }

  const results = (value as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    throw new EvidenceRetrievalError("EVIDENCE_INVALID_RESPONSE");
  }

  const candidates: EvidenceCandidate[] = [];
  for (const result of results) {
    if (candidates.length === 5) break;
    if (typeof result !== "object" || result === null || Array.isArray(result)) continue;

    const record = result as Record<string, unknown>;
    const url = normalizeUrl(record.url);
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!url || !content) continue;

    const title = typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : null;
    const retrievalScore = typeof record.score === "number" && Number.isFinite(record.score)
      ? record.score
      : null;

    candidates.push({ url, title, content, retrievalScore });
  }

  return candidates;
}

export async function requestTavilySearch(
  request: TavilySearchRequest,
  options: { apiKey?: string; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<unknown> {
  const apiKey = options.apiKey ?? process.env.TAVILY_API_KEY;
  if (!apiKey) throw new EvidenceRetrievalError("EVIDENCE_CONFIGURATION_ERROR");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TAVILY_TIMEOUT_MS);
  try {
    const response = await (options.fetch ?? fetch)(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new EvidenceRetrievalError("EVIDENCE_AUTH_ERROR");
    }
    if (response.status === 429) {
      throw new EvidenceRetrievalError("EVIDENCE_RATE_LIMITED");
    }
    if (!response.ok) {
      throw new EvidenceRetrievalError("EVIDENCE_PROVIDER_ERROR");
    }

    try {
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new EvidenceRetrievalError("EVIDENCE_PROVIDER_TIMEOUT");
      }
      throw new EvidenceRetrievalError("EVIDENCE_INVALID_RESPONSE");
    }
  } catch (error) {
    if (error instanceof EvidenceRetrievalError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new EvidenceRetrievalError("EVIDENCE_PROVIDER_TIMEOUT");
    }
    throw new EvidenceRetrievalError("EVIDENCE_PROVIDER_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieveEvidence(
  body: unknown,
  options: { apiKey?: string; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ candidates: EvidenceCandidate[] } | EvidenceInputFailure> {
  const input = validateEvidenceClaim(body);
  if (!input.ok) return input;

  const response = await requestTavilySearch(createTavilySearchRequest(input.claim), options);
  return { candidates: normalizeTavilyResponse(response) };
}
