export type PendingClaim = { claim: string; attempt: number };

export type ClaimRejectionAction =
  | { action: "retry"; attempt: number; rejectedClaims: string[] }
  | { action: "unresolved"; reason: "rejected_limit" };

export function acceptClaim(pending: PendingClaim): { claim: string } {
  return { claim: pending.claim };
}

export function rejectClaim(
  pending: PendingClaim,
  previouslyRejected: string[],
): ClaimRejectionAction {
  if (pending.attempt >= 3) {
    return { action: "unresolved", reason: "rejected_limit" };
  }
  return {
    action: "retry",
    attempt: pending.attempt + 1,
    rejectedClaims: [...previouslyRejected, pending.claim],
  };
}
