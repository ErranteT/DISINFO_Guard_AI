import { extractClaim, type ClaimCompletion } from "./claim-extractor.ts";
import { prepareMaterial, type PreparedMaterial } from "./prepare-material.ts";
import type { PrepareUrlValidation } from "./validate-prepare-url.ts";

export type ClaimFlowSuccess =
  | { status: "claim_pending"; claim: string; attempt: number }
  | {
      status: "claim_unresolved";
      reason: "no_checkable_claim" | "insufficient_content";
    };

type InputFailure = {
  ok: false;
  code: "INVALID_ATTEMPT" | "INVALID_REJECTED_CLAIMS";
  message: string;
};

export type PrepareClaimFlowResult =
  | ClaimFlowSuccess
  | InputFailure
  | Exclude<PrepareUrlValidation, { ok: true }>;

type PrepareMaterialFn = (
  value: unknown,
) => Promise<PreparedMaterial | Exclude<PrepareUrlValidation, { ok: true }>>;

type ClaimFlowDependencies = {
  prepare?: PrepareMaterialFn;
  complete?: ClaimCompletion;
};

type ValidatedFlowInput = {
  ok: true;
  url: unknown;
  attempt: number;
  rejectedClaims: string[];
};

function validateFlowInput(body: unknown): ValidatedFlowInput | InputFailure {
  const record = typeof body === "object" && body !== null && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const attempt = record.attempt === undefined ? 1 : record.attempt;
  if (!Number.isInteger(attempt) || (attempt as number) < 1 || (attempt as number) > 3) {
    return {
      ok: false,
      code: "INVALID_ATTEMPT",
      message: "The attempt number must be an integer from 1 to 3.",
    };
  }

  const rejectedClaims = record.rejectedClaims === undefined ? [] : record.rejectedClaims;
  if (
    !Array.isArray(rejectedClaims) ||
    rejectedClaims.length > 2 ||
    rejectedClaims.length !== (attempt as number) - 1 ||
    rejectedClaims.some((claim) => typeof claim !== "string" || !claim.trim() || claim.trim().length > 300)
  ) {
    return {
      ok: false,
      code: "INVALID_REJECTED_CLAIMS",
      message: "The rejected claims list does not match the attempt number.",
    };
  }

  return {
    ok: true,
    url: record.url,
    attempt: attempt as number,
    rejectedClaims: rejectedClaims.map((claim) => claim.trim()),
  };
}

export async function prepareClaimFlow(
  body: unknown,
  dependencies: ClaimFlowDependencies = {},
): Promise<PrepareClaimFlowResult> {
  const input = validateFlowInput(body);
  if (!input.ok) return input;

  const prepared = await (dependencies.prepare ?? prepareMaterial)(input.url);
  if ("ok" in prepared) return prepared;

  const extracted = await extractClaim(
    prepared.text,
    input.rejectedClaims,
    dependencies.complete,
  );
  if (extracted.status === "no_claim") {
    return { status: "claim_unresolved", reason: extracted.reason };
  }
  return { status: "claim_pending", claim: extracted.claim, attempt: input.attempt };
}
