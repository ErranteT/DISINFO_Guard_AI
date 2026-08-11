# Architektura — DISINFO-Guard AI

## Cel dokumentu

Dokument opisuje zatwierdzoną architekturę logiczną Course MVP DISINFO-Guard AI.

Stanowi źródło prawdy dla implementacji technicznej i określa granice odpowiedzialności poszczególnych elementów systemu.

Dokument nie oznacza, że wszystkie opisane elementy zostały już zaimplementowane.

## Stan obecny

Projekt znajduje się na etapie przygotowania fundamentu technicznego.

Na tym etapie działa pierwszy pionowy wycinek przygotowania URL:

- nie działa jeszcze pipeline analizy;
- Supabase nie jest jeszcze zintegrowany;
- Tavily nie jest jeszcze zintegrowane;
- LLM nie jest jeszcze podłączony;
- działa endpoint `POST /api/prepare`;
- nie ma zewnętrznego pobierania stron ani zapisu analiz;
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

## Zaimplementowany wycinek: `prepare`

```text
centralny radial hub
    ↓
formularz URL i POST /api/prepare
    ↓
Next.js Route Handler
    ↓
validatePrepareUrl()
    ↓
ustrukturyzowany JSON response
    ↓
lokalny stan UI: loading / success / error
```

Route Handler jest właścicielem warstwy HTTP: odczytuje body JSON, przekazuje wyłącznie pole `url` do `validatePrepareUrl()` i mapuje wynik na odpowiedź HTTP. Walidator jest oddzielony od handlera, dzięki czemu reguły URL można testować bez warstwy HTTP.

Request ma minimalny kontrakt:

```json
{
  "url": "https://example.com/article"
}
```

Prawidłowy adres zwraca `200 OK` z `{ "status": "ready", "url": string }`. Błędy wejścia zwracają `400 Bad Request`, status `invalid_input` i jeden z kodów `URL_REQUIRED`, `INVALID_URL`, `UNSUPPORTED_PROTOCOL` lub `LOCAL_URL_NOT_ALLOWED`. Nieoczekiwany błąd handlera zwraca `500 Internal Server Error` ze statusem `error` i kodem `INTERNAL_ERROR`.

Walidacja wymaga niepustego stringa po `trim()`, poprawnego URL oraz protokołu `http:` lub `https:`. Blokuje `localhost`, subdomeny `*.localhost`, IPv4 z zakresu `127.0.0.0/8` i IPv6 `::1`. Są to tylko podstawowe blokady lokalnych adresów, a nie pełna ochrona SSRF. Pełna ochrona SSRF zostanie zaprojektowana przy etapie rzeczywistego fetchowania zewnętrznych stron, ponieważ obecny etap nie wykonuje żadnego zewnętrznego fetchu.

Status `ready` oznacza wyłącznie zaakceptowanie URL przez backendową walidację i gotowość do przyszłego etapu. Nie oznacza pobrania treści, wyodrębnienia claimu, wyszukania źródeł ani zakończenia analizy. W tym wycinku nie istnieją integracje z Tavily, LLM ani Supabase.

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
