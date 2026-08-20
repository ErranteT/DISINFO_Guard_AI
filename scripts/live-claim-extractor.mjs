import {
  GROQ_CHAT_COMPLETIONS_URL,
  GROQ_MODEL,
  createClaimExtractorRequest,
  requestGroqClaimCompletion,
  validateClaimExtractorOutput,
} from "../lib/claim-extractor.ts";

if (!process.env.GROQ_API_KEY) {
  console.error("Brak GROQ_API_KEY. Dodaj go lokalnie do ignorowanego pliku .env.local.");
  process.exitCode = 1;
} else {
  const preparedText =
    "W komunikacie opublikowanym 12 maja urząd miasta podał, że nowa linia tramwajowa rozpocznie kursowanie 1 czerwca.";
  const request = createClaimExtractorRequest(preparedText);

  console.log("=== SAFE REQUEST EVIDENCE (bez sekretu) ===");
  console.log(JSON.stringify({
    provider: "Groq Cloud",
    model: GROQ_MODEL,
    sdk: "native fetch (OpenAI-compatible HTTP API)",
    method: "POST",
    endpoint: GROQ_CHAT_COMPLETIONS_URL,
    headers: { Authorization: "Bearer [REDACTED]", "Content-Type": "application/json" },
    apiKeyLocation: "backend process environment loaded locally from ignored .env.local",
    payload: request,
  }, null, 2));

  try {
    const rawContent = await requestGroqClaimCompletion(request);
    let structuredResponse = rawContent;
    if (typeof rawContent === "string") {
      try { structuredResponse = JSON.parse(rawContent); } catch { /* validation reports failure */ }
    }
    const validationResult = validateClaimExtractorOutput(structuredResponse);
    console.log("=== STRUCTURED RESPONSE ===");
    console.log(JSON.stringify(structuredResponse, null, 2));
    console.log("=== BACKEND VALIDATION ===");
    console.log(JSON.stringify({ valid: validationResult !== null, result: validationResult }, null, 2));
    if (!validationResult) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Nieznany błąd live testu");
    process.exitCode = 1;
  }
}
