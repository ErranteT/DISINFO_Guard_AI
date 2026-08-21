import {
  TAVILY_SEARCH_URL,
  createTavilySearchRequest,
  normalizeTavilyResponse,
  requestTavilySearch,
} from "../lib/evidence-retrieval.ts";

if (!process.env.TAVILY_API_KEY) {
  console.error("Brak TAVILY_API_KEY. Dodaj go lokalnie do ignorowanego pliku .env.local.");
  process.exitCode = 1;
} else {
  const claim = "The European Union approved the AI Act in 2024.";
  const request = createTavilySearchRequest(claim);

  console.log("=== SAFE TAVILY REQUEST (bez sekretu) ===");
  console.log(JSON.stringify({
    method: "POST",
    endpoint: TAVILY_SEARCH_URL,
    headers: { Authorization: "Bearer [REDACTED]", "Content-Type": "application/json" },
    apiKeyLocation: "backend process environment loaded locally from ignored .env.local",
    payload: request,
  }, null, 2));

  try {
    const response = await requestTavilySearch(request);
    console.log("=== TAVILY RESPONSE ===");
    console.log(JSON.stringify(response, null, 2));
    console.log("=== NORMALIZED CANDIDATES ===");
    console.log(JSON.stringify({ candidates: normalizeTavilyResponse(response) }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Nieznany błąd live testu");
    process.exitCode = 1;
  }
}
