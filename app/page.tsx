"use client";

import { FormEvent, useState } from "react";
import { acceptClaim, rejectClaim, type PendingClaim } from "@/lib/claim-review";
import type { EvidenceClassification, EvidenceRelation } from "@/lib/evidence-analysis";
import type { EvidenceCandidate } from "@/lib/evidence-retrieval";
import styles from "./page.module.css";

type RequestState =
  | "idle"
  | "loading"
  | "claim_pending"
  | "claim_unresolved"
  | "error";

type UnresolvedReason = "no_checkable_claim" | "insufficient_content" | "rejected_limit";
type EvidenceState = "idle" | "loading" | "success" | "error";
type AnalyzedEvidenceCandidate = EvidenceCandidate & EvidenceClassification;

const technicalErrorMessage =
  "Nie udało się wyodrębnić twierdzenia. Spróbuj ponownie za chwilę.";
const evidenceErrorMessage =
  "Nie udało się wyszukać lub przeanalizować materiałów. Spróbuj ponownie za chwilę.";

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

function relationLabel(relation: EvidenceRelation): string {
  if (relation === "supports") return "Wspiera";
  if (relation === "contradicts") return "Podważa";
  if (relation === "context") return "Kontekst";
  return "Nieistotny";
}

function unresolvedMessage(reason: UnresolvedReason): string {
  if (reason === "insufficient_content") {
    return "Materiał nie zawiera wystarczającej treści do wyodrębnienia twierdzenia.";
  }
  if (reason === "rejected_limit") {
    return "Odrzucono trzy propozycje. Nie udało się uzyskać twierdzenia do dalszej analizy.";
  }
  return "W materiale nie znaleziono jednego konkretnego, sprawdzalnego twierdzenia.";
}

export default function Home() {
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
    setEvidenceState("idle");
    setEvidenceCandidates([]);
    await requestClaim(1, []);
  }

  function handleAccept() {
    if (!pendingClaim) return;
    const result = acceptClaim(pendingClaim);
    setAcceptedClaim(result.claim);
    setPendingClaim(null);
    setRequestState("idle");
    setEvidenceState("idle");
    setEvidenceCandidates([]);
  }

  async function handleStartAnalysis() {
    if (!acceptedClaim || evidenceState === "loading") return;
    setEvidenceState("loading");
    setEvidenceCandidates([]);

    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: acceptedClaim }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setEvidenceState("error");
        return;
      }

      if (response.ok && isEvidenceResponse(payload)) {
        const candidates = payload.candidates.slice(0, 5);
        if (candidates.length === 0) {
          setEvidenceState("success");
          return;
        }

        const analysisResponse = await fetch("/api/evidence/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim: acceptedClaim, candidates }),
        });
        let analysisPayload: unknown;
        try {
          analysisPayload = await analysisResponse.json();
        } catch {
          setEvidenceState("error");
          return;
        }
        if (!analysisResponse.ok || !isEvidenceAnalysisResponse(analysisPayload, candidates.length)) {
          setEvidenceState("error");
          return;
        }

        const classifications = new Map(
          analysisPayload.classifications.map((classification) => [
            classification.candidateIndex,
            classification,
          ]),
        );
        setEvidenceCandidates(candidates.map((candidate, candidateIndex) => ({
          ...candidate,
          ...classifications.get(candidateIndex)!,
        })));
        setEvidenceState("success");
        return;
      }
      setEvidenceState("error");
    } catch {
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
    setEvidenceState("idle");
    setEvidenceCandidates([]);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.shield} aria-hidden="true">✓</span>
          <span>DISINFO-Guard <em>AI</em></span>
        </div>
        <p>Sprawdzaj informacje odpowiedzialnie.</p>
      </header>

      <section className={styles.hero} aria-labelledby="page-title">
        <span className={styles.eyebrow}>Wyodrębnianie twierdzenia</span>
        <h1 id="page-title">Sprawdź, zanim uwierzysz.</h1>
        <p>Dodaj adres artykułu lub posta, aby wyodrębnić jedno twierdzenie do dalszej analizy.</p>
      </section>

      {!showForm ? (
        <section className={styles.hub} aria-label="Rozpocznij przygotowanie adresu">
          <span className={`${styles.line} ${styles.lineOne}`} aria-hidden="true" />
          <span className={`${styles.line} ${styles.lineTwo}`} aria-hidden="true" />
          <span className={`${styles.line} ${styles.lineThree}`} aria-hidden="true" />
          <span className={`${styles.line} ${styles.lineFour}`} aria-hidden="true" />
          <div className={`${styles.node} ${styles.nodeTopLeft}`} aria-hidden="true">
            <span>◌</span>Źródła<br /><small>w kolejnych etapach</small>
          </div>
          <div className={`${styles.node} ${styles.nodeTopRight}`} aria-hidden="true">
            <span>◷</span>Historia<br /><small>w kolejnych etapach</small>
          </div>
          <div className={`${styles.node} ${styles.nodeBottomLeft}`} aria-hidden="true">
            <span>◇</span>Kontekst<br /><small>w kolejnych etapach</small>
          </div>
          <div className={`${styles.node} ${styles.nodeBottomRight}`} aria-hidden="true">
            <span>↗</span>Link URL<br /><small>zacznij tutaj</small>
          </div>
          <button className={styles.hubButton} type="button" onClick={() => setShowForm(true)}>
            <span className={styles.hubIcon} aria-hidden="true">✦</span>
            <strong>Sprawdź<br />adres URL</strong>
            <small>Kliknij, aby zacząć</small>
          </button>
        </section>
      ) : (
        <section className={styles.formCard} aria-labelledby="form-title">
          <div className={styles.formHeading}>
            <div>
              <h2 id="form-title">Dodaj adres URL</h2>
              <p>Pobierzemy materiał i wyodrębnimy jedno sprawdzalne twierdzenie.</p>
            </div>
            <button className={styles.backButton} type="button" onClick={resetToHub}>
              Wróć do hubu
            </button>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="article-url">Adres artykułu lub posta</label>
            <input
              id="article-url"
              className={inputError ? styles.inputInvalid : undefined}
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/artykul"
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? "url-error" : undefined}
              disabled={requestState === "loading"}
            />
            {inputError ? <p id="url-error" className={styles.inputError} role="alert">{inputError}</p> : null}
            <button className={styles.submitButton} type="submit" disabled={requestState === "loading"}>
              {requestState === "loading" ? "Analizuję materiał…" : "Wyodrębnij twierdzenie"}
            </button>
          </form>

          {requestState === "claim_pending" && pendingClaim ? (
            <section className={styles.claimCard} aria-labelledby="claim-title">
              <p className={styles.claimAttempt}>Propozycja {pendingClaim.attempt} z 3</p>
              <h3 id="claim-title">Wyodrębnione twierdzenie</h3>
              <blockquote>{pendingClaim.claim}</blockquote>
              <div className={styles.claimActions}>
                <button className={styles.acceptButton} type="button" onClick={handleAccept}>Akceptuj</button>
                <button className={styles.rejectButton} type="button" onClick={handleReject}>Odrzuć</button>
              </div>
            </section>
          ) : null}

          {acceptedClaim ? (
            <section className={styles.evidenceSection} aria-labelledby="accepted-claim-title">
              <div className={styles.successMessage} role="status">
                <strong id="accepted-claim-title">Twierdzenie zaakceptowane.</strong>
                <p>{acceptedClaim}</p>
                <span>Możesz teraz wyszukać materiały dotyczące tego twierdzenia.</span>
              </div>
              <button
                className={styles.analysisButton}
                type="button"
                onClick={handleStartAnalysis}
                disabled={evidenceState === "loading"}
              >
                {evidenceState === "loading" ? "Analizuję materiały…" : "Rozpocznij analizę"}
              </button>

              {evidenceState === "success" ? (
                <div className={styles.evidenceResults} role="status">
                  <h3>Znalezione materiały</h3>
                  <p>Znaleziono: {evidenceCandidates.length}</p>
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
                            <strong>Relacja do twierdzenia: {relationLabel(candidate.relation)}</strong>
                            <span>{candidate.reason}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Wyszukiwanie zakończyło się poprawnie, ale nie znaleziono użytecznych materiałów.</p>
                  )}
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
