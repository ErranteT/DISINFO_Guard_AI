# Architektura — DISINFO-Guard AI

## Cel dokumentu

Dokument opisuje zatwierdzoną architekturę logiczną Course MVP DISINFO-Guard AI.

Stanowi źródło prawdy dla implementacji technicznej i określa granice odpowiedzialności poszczególnych elementów systemu.

Dokument nie oznacza, że wszystkie opisane elementy zostały już zaimplementowane.

## Stan obecny

Projekt posiada pionowy wycinek bezpiecznego przygotowania materiału z URL i Claim Flow:

- nie działa jeszcze pipeline analizy dowodów;
- Supabase nie jest jeszcze zintegrowany;
- Tavily nie jest jeszcze zintegrowane;
- Claim Extractor jest podłączony do jednego modelu LLM przez Groq;
- działa endpoint `POST /api/prepare`;
- działa kontrolowane pobieranie HTML/plain text, ekstrakcja jednego claimu i decyzja Accept/Reject, bez zapisu analiz;
- deployment produkcyjny nie został jeszcze wykonany.

## Docelowy stack Course MVP

Zatwierdzony stack:

- Next.js;
- TypeScript;
- Route Handlers;
- Supabase;
- Tavily;
- jeden model LLM ukryty za warstwą abstrakcji;
- Vercel.

Aplikacja pozostaje jednym projektem Next.js. Nie planuje się osobnej aplikacji backendowej.

## Główna zasada architektury

Backend jest właścicielem:

- orkiestracji procesu;
- walidacji danych;
- statusów aplikacji;
- reguł wystarczalności dowodów;
- komunikacji z usługami zewnętrznymi;
- decyzji o finalnym stanie analizy.

Frontend nie powinien samodzielnie wyznaczać statusów analizy.

LLM nie powinien samodzielnie wyznaczać finalnego statusu aplikacji.

## Zaimplementowany wycinek: `prepare` / SAFE FETCH / Claim Flow

```text
centralny radial hub
    ↓
formularz URL i POST /api/prepare
    ↓
Next.js Route Handler
    ↓
validatePrepareUrl()
    ↓
DNS i klasyfikacja wszystkich IP (fail-closed)
    ↓
kontrolowany request ze związanym lookup
    ↓
ręczne, ponownie walidowane redirecty
    ↓
limity i polityka odpowiedzi
    ↓
minimalne HTML/plain text → tekst
    ↓
limit `preparedText.slice(0, 15000)`
    ↓
Groq `openai/gpt-oss-20b` i strict JSON Schema
    ↓
backendowa walidacja structured output
    ↓
`claim_pending` albo `claim_unresolved`
    ↓
lokalny UX: Accept / Reject / retry do trzeciej próby
```

Route Handler jest cienką warstwą HTTP: odczytuje body JSON, uruchamia orkiestrację przygotowania materiału i ekstrakcji claimu oraz mapuje kontrolowane wyniki na JSON. Walidacja wejścia, target/DNS/IP safety, transport HTTP, konwersja treści, klient Groq i walidacja wyniku LLM są rozdzielone w `lib/`.

Pierwszy request ma kontrakt:

```json
{
  "url": "https://example.com/article"
}
```

Retry po Reject ponownie wykonuje SAFE FETCH:

```json
{
  "url": "https://example.com/article",
  "attempt": 2,
  "rejectedClaims": ["Pierwszy odrzucony claim"]
}
```

Prawidłowy claim zwraca `200 OK` jako `{ "status": "claim_pending", "claim": "...", "attempt": 1 }`. Pełny prepared text, final URL i content type pozostają wewnętrzne. `no_claim` jest wynikiem domenowym mapowanym natychmiast na `claim_unresolved`, bez kolejnego wywołania LLM i bez zwiększenia `attempt`. Błędy wejścia zachowują status `invalid_input`; kontrolowane błędy SAFE FETCH i Claim Extractora zwracają status `error` ze stabilnym kodem.

Walidacja wejścia wymaga niepustego stringa, poprawnego URL i protokołu HTTP/HTTPS oraz zachowuje wcześniejsze blokady lokalnych adresów. Przed każdym requestem — również po redirectach — hostname jest rozwiązywany, a każdy wynik DNS musi być publicznym, routowalnym adresem. Literalne IP przechodzą tę samą klasyfikację. Zaakceptowany adres jest przypinany do właściwego requestu przez kontrolowany `lookup`, co eliminuje niezależne ponowne rozwiązanie DNS.

Redirecty 301, 302, 303, 307 i 308 są obsługiwane ręcznie, maksymalnie 3 razy. Każdy request ma limit 10 sekund, a surowe body limit 2 MB sprawdzany z `Content-Length` i podczas odczytu strumienia. Sukces wymaga statusu 2xx, `text/html` lub `text/plain`, UTF-8 oraz braku kodowania transportowego innego niż `identity`.

HTML jest parsowany przez `parse5`; usuwane są `script`, `style` i `noscript`, po czym tekst jest normalizowany. Nie ma Readability, renderowania JavaScriptu ani ekstrakcji metadanych. `ready` pozostaje wyłącznie wewnętrznym stanem przygotowanego materiału.

Claim Extractor korzysta z backendowego `GROQ_API_KEY`, natywnego `fetch`, `POST https://api.groq.com/openai/v1/chat/completions` oraz jednego modelu `openai/gpt-oss-20b`. Materiał jest niezaufanymi danymi w osobnej wiadomości `user`. Strict JSON Schema nie zastępuje backendowej walidacji. Malformed output otrzymuje dokładnie jeden technical retry; timeout, rate limit, provider error, brak konfiguracji i `no_claim` nie są automatycznie ponawiane.

Licznik prób i lista odrzuconych claimów żyją w stanie frontendu. Backend waliduje format i zakres `attempt` 1–3, lecz bez trwałego lub podpisanego stanu limit nie jest security boundary odporną na ręczne manipulowanie requestem. Accept daje jedynie lokalne potwierdzenie gotowości claimu do przyszłego `run`; Tavily, evidence, `run`, Supabase i trwały zapis nie istnieją w tym wycinku.

## Docelowy główny przepływ Course MVP

```text
Użytkownik
    ↓
podaje URL
    ↓
Frontend
    ↓
Backend / Route Handler
    ↓
walidacja URL i próba uzyskania materiału
    ↓
wyodrębnienie kandydata na claim
    ↓
Frontend
    ↓
użytkownik zatwierdza claim
    ↓
Backend
    ↓
wyszukiwanie materiałów przez Tavily
    ↓
interpretacja dostarczonych materiałów przez LLM
    ↓
walidacja odpowiedzi LLM
    ↓
backendowe reguły wystarczalności dowodów
    ↓
zapis wyniku
    ↓
Frontend prezentuje wynik i źródła
