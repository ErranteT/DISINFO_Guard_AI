# Architektura — DISINFO-Guard AI

## Cel dokumentu

Dokument opisuje zatwierdzoną architekturę logiczną Course MVP DISINFO-Guard AI.

Stanowi źródło prawdy dla implementacji technicznej i określa granice odpowiedzialności poszczególnych elementów systemu.

Dokument nie oznacza, że wszystkie opisane elementy zostały już zaimplementowane.

## Stan obecny

Projekt posiada pionowy wycinek bezpiecznego przygotowania materiału z URL:

- nie działa jeszcze pipeline analizy;
- Supabase nie jest jeszcze zintegrowany;
- Tavily nie jest jeszcze zintegrowane;
- LLM nie jest jeszcze podłączony;
- działa endpoint `POST /api/prepare`;
- działa kontrolowane pobieranie HTML/plain text, bez zapisu analiz;
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

## Zaimplementowany wycinek: `prepare` / SAFE FETCH

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
ustrukturyzowany JSON response
    ↓
lokalny stan UI: loading / success / error
```

Route Handler jest cienką warstwą HTTP: odczytuje body JSON, uruchamia orkiestrację przygotowania materiału i mapuje kontrolowane wyniki na JSON. Walidacja wejścia, target/DNS/IP safety, transport HTTP oraz konwersja treści są rozdzielone w `lib/`.

Request ma minimalny kontrakt:

```json
{
  "url": "https://example.com/article"
}
```

Prawidłowo przygotowany materiał zwraca `200 OK` z polami `status`, `url`, `finalUrl`, `contentType` i `text`. Błędy wejścia zachowują status `invalid_input` oraz kody `URL_REQUIRED`, `INVALID_URL`, `UNSUPPORTED_PROTOCOL` i `LOCAL_URL_NOT_ALLOWED`. Kontrolowane błędy SAFE FETCH zwracają status `error` i stabilny kod; nieoczekiwany błąd handlera zwraca `INTERNAL_ERROR` bez surowych szczegółów infrastruktury.

Walidacja wejścia wymaga niepustego stringa, poprawnego URL i protokołu HTTP/HTTPS oraz zachowuje wcześniejsze blokady lokalnych adresów. Przed każdym requestem — również po redirectach — hostname jest rozwiązywany, a każdy wynik DNS musi być publicznym, routowalnym adresem. Literalne IP przechodzą tę samą klasyfikację. Zaakceptowany adres jest przypinany do właściwego requestu przez kontrolowany `lookup`, co eliminuje niezależne ponowne rozwiązanie DNS.

Redirecty 301, 302, 303, 307 i 308 są obsługiwane ręcznie, maksymalnie 3 razy. Każdy request ma limit 10 sekund, a surowe body limit 2 MB sprawdzany z `Content-Length` i podczas odczytu strumienia. Sukces wymaga statusu 2xx, `text/html` lub `text/plain`, UTF-8 oraz braku kodowania transportowego innego niż `identity`.

HTML jest parsowany przez `parse5`; usuwane są `script`, `style` i `noscript`, po czym tekst jest normalizowany. Nie ma Readability, renderowania JavaScriptu, ekstrakcji metadanych ani Claim Extractora. Status `ready` oznacza wyłącznie gotowy tekst, a nie wyszukanie źródeł lub zakończenie analizy. W tym wycinku nie istnieją integracje z Tavily, LLM ani Supabase.

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
