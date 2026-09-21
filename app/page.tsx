"use client";

import { FormEvent, useRef, useState } from "react";
import { acceptClaim, rejectClaim, type PendingClaim } from "@/lib/claim-review";
import {
  overallPatternLabels,
  relationLabel,
  runEvidenceFlow,
  synthesisErrorMessages,
  type AnalyzedEvidenceCandidate,
} from "@/lib/evidence-flow";
import type { EvidenceSynthesisErrorCode, EvidenceSynthesisResult } from "@/lib/evidence-synthesis";
import styles from "./page.module.css";

type RequestState =
  | "idle"
  | "loading"
  | "claim_pending"
  | "claim_unresolved"
  | "error";

type UnresolvedReason = "no_checkable_claim" | "insufficient_content" | "rejected_limit";
type EvidenceState = "idle" | "loading" | "success" | "error";

const technicalErrorMessage =
  "We couldn't extract a claim. Please try again in a moment.";
const evidenceErrorMessage =
  "We couldn't find or analyse evidence. Please try again in a moment.";

function isClaimPendingResponse(value: unknown): value is {
  status: "claim_pending"; claim: string; attempt: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { status?: unknown }).status === "claim_pending" &&
    typeof (value as { claim?: unknown }).claim === "string" &&
    Number.isInteger((value as { attempt?: unknown }).attempt) &&
    Number((value as { attempt?: unknown }).attempt) >= 1 &&
    Number((value as { attempt?: unknown }).attempt) <= 3
  );
}

function isClaimUnresolvedResponse(value: unknown): value is {
  status: "claim_unresolved";
  reason: "no_checkable_claim" | "insufficient_content";
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { status?: unknown }).status === "claim_unresolved" &&
    ["no_checkable_claim", "insufficient_content"].includes(
      String((value as { reason?: unknown }).reason),
    )
  );
}

function isControlledErrorResponse(
  value: unknown,
): value is { status: "invalid_input" | "error"; code: string; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    ["invalid_input", "error"].includes((value as { status?: string }).status ?? "") &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function unresolvedMessage(reason: UnresolvedReason): string {
  if (reason === "insufficient_content") {
    return "The material does not contain enough content to extract a claim.";
  }
  if (reason === "rejected_limit") {
    return "Three suggestions were rejected. We couldn't identify a claim for further analysis.";
  }
  return "No single, specific, checkable claim was found in the material.";
}

export default function Home() {
  const evidenceRunIdRef = useRef(0);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  const [acceptedClaim, setAcceptedClaim] = useState("");
  const [rejectedClaims, setRejectedClaims] = useState<string[]>([]);
  const [unresolvedReason, setUnresolvedReason] = useState<UnresolvedReason | null>(null);
  const [inputError, setInputError] = useState("");
  const [technicalError, setTechnicalError] = useState("");
  const [evidenceState, setEvidenceState] = useState<EvidenceState>("idle");
  const [evidenceCandidates, setEvidenceCandidates] = useState<AnalyzedEvidenceCandidate[]>([]);
  const [synthesis, setSynthesis] = useState<EvidenceSynthesisResult | null>(null);
  const [synthesisError, setSynthesisError] = useState<EvidenceSynthesisErrorCode | null>(null);

  function resetEvidenceResult() {
    evidenceRunIdRef.current += 1;
    setEvidenceState("idle");
    setEvidenceCandidates([]);
    setSynthesis(null);
    setSynthesisError(null);
  }

  async function requestClaim(attempt: number, previousRejectedClaims: string[]) {
    setRequestState("loading");
    setInputError("");
    setTechnicalError("");

    try {
      const body = attempt === 1
        ? { url }
        : { url, attempt, rejectedClaims: previousRejectedClaims };
      const response = await fetch("/api/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setRequestState("error");
        setTechnicalError(technicalErrorMessage);
        return;
      }

      if (response.ok && isClaimPendingResponse(payload)) {
        setPendingClaim({ claim: payload.claim, attempt: payload.attempt });
        setRejectedClaims(previousRejectedClaims);
        setRequestState("claim_pending");
        return;
      }
      if (response.ok && isClaimUnresolvedResponse(payload)) {
        setPendingClaim(null);
        setUnresolvedReason(payload.reason);
        setRequestState("claim_unresolved");
        return;
      }
      if (isControlledErrorResponse(payload) && payload.status === "invalid_input") {
        setRequestState("error");
        setInputError(payload.message);
        return;
      }

      setRequestState("error");
      setTechnicalError(technicalErrorMessage);
    } catch {
      setRequestState("error");
      setTechnicalError(technicalErrorMessage);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingClaim(null);
    setAcceptedClaim("");
    setRejectedClaims([]);
    setUnresolvedReason(null);
    resetEvidenceResult();
    await requestClaim(1, []);
  }

  function handleAccept() {
    if (!pendingClaim) return;
    const result = acceptClaim(pendingClaim);
    setAcceptedClaim(result.claim);
    setPendingClaim(null);
    setRequestState("idle");
    resetEvidenceResult();
  }

  async function handleStartAnalysis() {
    if (!acceptedClaim || evidenceState === "loading") return;
    const runId = evidenceRunIdRef.current + 1;
    evidenceRunIdRef.current = runId;
    const isActive = () => evidenceRunIdRef.current === runId;
    setEvidenceState("loading");
    setEvidenceCandidates([]);
    setSynthesis(null);
    setSynthesisError(null);

    try {
      const result = await runEvidenceFlow(acceptedClaim, fetch, isActive);
      if (!isActive()) return;
      setEvidenceCandidates(result.evidenceCandidates);
      setSynthesis(result.synthesis);
      setSynthesisError(result.synthesisError);
      setEvidenceState("success");
    } catch {
      if (!isActive()) return;
      setEvidenceState("error");
    }
  }

  async function handleReject() {
    if (!pendingClaim) return;
    const result = rejectClaim(pendingClaim, rejectedClaims);
    if (result.action === "unresolved") {
      setPendingClaim(null);
      setUnresolvedReason(result.reason);
      setRequestState("claim_unresolved");
      return;
    }
    if (result.action === "retry") {
      await requestClaim(result.attempt, result.rejectedClaims);
    }
  }

  function resetToHub() {
    setShowForm(false);
    setRequestState("idle");
    setPendingClaim(null);
    setAcceptedClaim("");
    setRejectedClaims([]);
    setUnresolvedReason(null);
    setInputError("");
    setTechnicalError("");
    resetEvidenceResult();
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.shield} aria-hidden="true">✓</span>
          <span>DISINFO-Guard <em>AI</em></span>
        </div>
        <p>Assess information responsibly.</p>
      </header>

      <section className={styles.hero} aria-labelledby="page-title">
        <span className={styles.eyebrow}>Claim review</span>
        <h1 id="page-title">Check before you trust.</h1>
        <p>Add the URL of an article or post to extract one claim for further analysis.</p>
      </section>

      {!showForm ? (
        <section className={styles.hub} aria-label="Start URL preparation">
          <span className={`${styles.line} ${styles.lineOne}`} aria-hidden="true" />
          <span className={`${styles.line} ${styles.lineTwo}`} aria-hidden="true" />
          <span className={`${styles.line} ${styles.lineThree}`} aria-hidden="true" />
          <span className={`${styles.line} ${styles.lineFour}`} aria-hidden="true" />
          <div className={`${styles.node} ${styles.nodeTopLeft}`} aria-hidden="true">
            <span>◌</span>Sources<br /><small>in later stages</small>
          </div>
          <div className={`${styles.node} ${styles.nodeTopRight}`} aria-hidden="true">
            <span>◷</span>History<br /><small>in later stages</small>
          </div>
          <div className={`${styles.node} ${styles.nodeBottomLeft}`} aria-hidden="true">
            <span>◇</span>Context<br /><small>in later stages</small>
          </div>
          <div className={`${styles.node} ${styles.nodeBottomRight}`} aria-hidden="true">
            <span>↗</span>URL link<br /><small>start here</small>
          </div>
          <button className={styles.hubButton} type="button" onClick={() => setShowForm(true)}>
            <span className={styles.hubIcon} aria-hidden="true">✦</span>
            <strong>Start with<br />a URL</strong>
            <small>Start here</small>
          </button>
        </section>
      ) : (
        <section className={styles.formCard} aria-labelledby="form-title">
          <div className={styles.formHeading}>
            <div>
              <h2 id="form-title">Add a URL</h2>
              <p>We’ll retrieve the material and extract one checkable claim.</p>
            </div>
            <button className={styles.backButton} type="button" onClick={resetToHub}>
              Back to hub
            </button>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="article-url">Article or post URL</label>
            <input
              id="article-url"
              className={inputError ? styles.inputInvalid : undefined}
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? "url-error" : undefined}
              disabled={requestState === "loading"}
            />
            {inputError ? <p id="url-error" className={styles.inputError} role="alert">{inputError}</p> : null}
            <button className={styles.submitButton} type="submit" disabled={requestState === "loading"}>
              {requestState === "loading" ? "Analysing material…" : "Extract claim"}
            </button>
          </form>

          {requestState === "claim_pending" && pendingClaim ? (
            <section className={styles.claimCard} aria-labelledby="claim-title">
              <p className={styles.claimAttempt}>Claim {pendingClaim.attempt} of 3</p>
              <h3 id="claim-title">Extracted claim</h3>
              <blockquote>{pendingClaim.claim}</blockquote>
              <div className={styles.claimActions}>
                <button className={styles.acceptButton} type="button" onClick={handleAccept}>Accept</button>
                <button className={styles.rejectButton} type="button" onClick={handleReject}>Reject</button>
              </div>
            </section>
          ) : null}

          {acceptedClaim ? (
            <section className={styles.evidenceSection} aria-labelledby="accepted-claim-title">
              <div className={styles.successMessage} role="status">
                <strong id="accepted-claim-title">Claim accepted.</strong>
                <p>{acceptedClaim}</p>
                <span>You can now search for evidence related to this claim.</span>
              </div>
              <button
                className={styles.analysisButton}
                type="button"
                onClick={handleStartAnalysis}
                disabled={evidenceState === "loading"}
              >
                {evidenceState === "loading" ? "Analysing evidence…" : "Start analysis"}
              </button>

              {evidenceState === "success" ? (
                <div className={styles.evidenceResults} role="status">
                  <h3>Evidence retrieved</h3>
                  <p>{evidenceCandidates.length} sources found</p>
                  {evidenceCandidates.length ? (
                    <ol>
                      {evidenceCandidates.map((candidate) => (
                        <li key={`${candidate.url}-${candidate.title ?? ""}`}>
                          <a href={candidate.url} target="_blank" rel="noreferrer">
                            {candidate.title ?? candidate.url}
                          </a>
                          {candidate.title ? <small>{candidate.url}</small> : null}
                          <p>{candidate.content}</p>
                          <div className={styles.evidenceRelation}>
                            <strong>Relation to claim: {relationLabel(candidate.relation)}</strong>
                            <span>{candidate.reason}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>The search completed successfully, but no useful evidence was found.</p>
                  )}
                  {synthesis || synthesisError ? (
                    <section className={styles.synthesisSection} aria-labelledby="synthesis-title">
                      <h4 id="synthesis-title">Evidence overview</h4>
                      {synthesis ? (
                        <>
                          <strong>{overallPatternLabels[synthesis.overallPattern]}</strong>
                          <p>{synthesis.summary}</p>
                        </>
                      ) : (
                        <p className={styles.technicalError} role="alert">
                          {synthesisErrorMessages[synthesisError!]}
                        </p>
                      )}
                    </section>
                  ) : null}
                </div>
              ) : null}
              {evidenceState === "error" ? (
                <p className={styles.technicalError} role="alert">{evidenceErrorMessage}</p>
              ) : null}
            </section>
          ) : null}

          {requestState === "claim_unresolved" && unresolvedReason ? (
            <p className={styles.unresolvedMessage} role="status">
              {unresolvedMessage(unresolvedReason)}
            </p>
          ) : null}
          {technicalError ? <p className={styles.technicalError} role="alert">{technicalError}</p> : null}
        </section>
      )}
    </main>
  );
}
