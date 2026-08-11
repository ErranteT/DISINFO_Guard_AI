"use client";

import { FormEvent, useState } from "react";
import styles from "./page.module.css";

type RequestState = "idle" | "loading" | "success" | "error";

const technicalErrorMessage =
  "Nie udało się przygotować adresu. Spróbuj ponownie za chwilę.";

function isReadyResponse(value: unknown): value is { status: "ready"; url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { status?: unknown }).status === "ready" &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

function isInputErrorResponse(
  value: unknown,
): value is { status: "invalid_input"; code: string; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { status?: unknown }).status === "invalid_input" &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [inputError, setInputError] = useState("");
  const [technicalError, setTechnicalError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("loading");
    setInputError("");
    setTechnicalError("");

    try {
      const response = await fetch("/api/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setRequestState("error");
        setTechnicalError(technicalErrorMessage);
        return;
      }

      if (response.ok) {
        if (!isReadyResponse(payload)) {
          setRequestState("error");
          setTechnicalError(technicalErrorMessage);
          return;
        }

        setRequestState("success");
        return;
      }

      if (
        response.status >= 400 &&
        response.status < 500 &&
        isInputErrorResponse(payload)
      ) {
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
        <span className={styles.eyebrow}>Przygotowanie materiału</span>
        <h1 id="page-title">Sprawdź, zanim uwierzysz.</h1>
        <p>Dodaj adres artykułu lub posta, który chcesz przygotować do dalszego etapu.</p>
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
            <strong>Przygotuj<br />adres URL</strong>
            <small>Kliknij, aby zacząć</small>
          </button>
        </section>
      ) : (
        <section className={styles.formCard} aria-labelledby="form-title">
          <div className={styles.formHeading}>
            <div>
              <h2 id="form-title">Dodaj adres URL</h2>
              <p>Na tym etapie sprawdzamy wyłącznie poprawność adresu.</p>
            </div>
            <button className={styles.backButton} type="button" onClick={() => setShowForm(false)}>
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
              {requestState === "loading" ? "Sprawdzam adres…" : "Przygotuj adres"}
            </button>
          </form>
          {requestState === "success" ? (
            <p className={styles.successMessage} role="status">
              Adres przeszedł walidację i jest gotowy do dalszego etapu.
            </p>
          ) : null}
          {technicalError ? <p className={styles.technicalError} role="alert">{technicalError}</p> : null}
        </section>
      )}
    </main>
  );
}
