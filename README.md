# DISINFO-Guard AI

DISINFO-Guard AI to aplikacja internetowa wspierająca użytkownika w ocenie konkretnego twierdzenia znalezionego w internecie na podstawie rzeczywiście dostępnych materiałów i źródeł.

Projekt jest rozwijany jako Course MVP w ramach kursu Vibe Coding.

## Problem

Użytkownicy regularnie spotykają się z sensacyjnymi, sprzecznymi lub trudnymi do zweryfikowania informacjami. Samodzielne odnalezienie źródeł i ocena jakości dostępnych dowodów wymaga czasu oraz wiedzy.

DISINFO-Guard AI ma ułatwiać ten proces, pokazując stan dostępnych dowodów dotyczących jednego konkretnego twierdzenia.

## Użytkownik

Głównym użytkownikiem jest osoba korzystająca z internetu i mediów społecznościowych, która chce szybko sprawdzić budzącą wątpliwości informację przed uznaniem jej za wiarygodną lub przekazaniem dalej.

## Zakres Course MVP

Docelowy Course MVP obejmuje rzeczywistą analizę materiału wskazanego przez URL.

Docelowy podstawowy przepływ:

1. Użytkownik podaje URL.
2. Backend waliduje adres i pobiera dostępny materiał.
3. System wyodrębnia jedno główne sprawdzalne twierdzenie.
4. Użytkownik zatwierdza twierdzenie przed rozpoczęciem właściwej analizy.
5. System pozyskuje rzeczywiste materiały zewnętrzne.
6. LLM interpretuje wyłącznie dostarczone materiały.
7. Backend waliduje wynik i stosuje reguły wystarczalności dowodów.
8. Użytkownik otrzymuje słowny status, profil dowodów, krótkie uzasadnienie i wykorzystane źródła.

## Zasady produktu

- Analizowane jest konkretne twierdzenie, a nie cały materiał jako jedna całość.
- System ocenia stan dostępnych dowodów, a nie „prawdę absolutną”.
- Brak dowodów nie oznacza automatycznie fałszu.
- `insufficient_data` jest prawidłowym wynikiem analizy.
- `claim_unresolved` jest prawidłowym zakończeniem procesu, jeżeli nie uda się uzyskać zaakceptowanego twierdzenia.
- Course MVP nie używa procentowego score.
- Backend jest właścicielem statusów, reguł i orkiestracji procesu.

## Główne ograniczenia Course MVP

Poza zakresem pozostają między innymi:

- rzeczywista analiza screenshotów i OCR;
- analiza audio i wideo;
- konta użytkowników;
- rozbudowana historia analiz;
- własny crawler lub RAG;
- wiele modeli LLM;
- procentowy scoring wiarygodności.

System nie gwarantuje poprawnego odczytania każdego URL dostępnego w internecie.

## UX

Istniejący prototyp HTML stanowi referencję UX/UI, a nie bazę techniczną aplikacji.

Kluczowym elementem koncepcji pozostaje centralny radial hub z główną akcją umieszczoną w centrum. Interfejs powinien zachować spokojny, czytelny i neutralny charakter.

## Stan projektu

Pionowy wycinek frontend → backend obejmuje SAFE FETCH, Claim Flow, retrieval materiałów oraz klasyfikację relacji każdego materiału do zaakceptowanego twierdzenia. Centralny radial hub prowadzi do formularza URL, który wysyła `POST /api/prepare`. Backend waliduje adres, wykonuje SAFE FETCH, przygotowuje tekst i przekazuje maksymalnie pierwsze 15 000 znaków do Claim Extractora. Extractor używa Groq Cloud i modelu `openai/gpt-oss-20b`; jego structured output jest niezależnie walidowany przez backend.

Pierwszy request przyjmuje `{ "url": "https://example.com/article" }`. Retry po odrzuceniu przyjmuje dodatkowo `attempt` od 2 do 3 oraz `rejectedClaims`. Stan licznika żyje w frontendzie i nie jest zabezpieczeniem odpornym na ręczne manipulowanie requestem.

Poprawny claim zwraca `claim_pending` z jednym twierdzeniem i numerem próby. Poprawny wynik `no_claim` natychmiast zwraca `claim_unresolved`. Frontend pozwala zaakceptować claim lub odrzucić go; maksymalnie trzecie odrzucenie kończy Claim Flow jako `claim_unresolved`. Accept nie uruchamia retrieval automatycznie. Po zaakceptowaniu użytkownik może wybrać „Rozpocznij analizę”, co wysyła `{ "claim": "..." }` do `POST /api/evidence`.

`POST /api/evidence` ponownie waliduje claim i wykonuje jeden backendowy Tavily Search z parametrami `basic`, `general`, maksymalnie 5 wyników oraz bez answer, raw content i obrazów. Wyniki są normalizowane do `url`, `title`, `content` i technicznego `retrievalScore`. Dla niepustej listy frontend wysyła claim i candidates do osobnego `POST /api/evidence/analyze`. Evidence Analyst otrzymuje wyłącznie claim oraz `candidateIndex` i `content`, po czym zwraca niezależnie walidowane `relation` i krótkie `reason` dla każdego materiału. UI pokazuje tytuł, link, fragment, relację i uzasadnienie. Poprawne wyszukiwanie bez użytecznych wyników zwraca `{ "candidates": [] }` i nie uruchamia Groq.

Obsługiwane są wyłącznie odpowiedzi `text/html` i `text/plain` w UTF-8, bez kompresji transportowej. Pojedynczy request ma limit 10 sekund, body limit 2 MB, a łańcuch może zawierać maksymalnie 3 ręcznie walidowane redirecty. HTML jest parsowany przez `parse5`; usuwane są `script`, `style` i `noscript`, bez Readability i bez wyboru głównego artykułu.

Użyte technologie w tym wycinku to Next.js, TypeScript, Route Handlers, `parse5` i natywny backendowy `fetch` do Groq oraz Tavily Search. Testy używają wbudowanego mechanizmu Node, mockują granice zewnętrznych usług i nie wymagają internetu ani kluczy API.

Docelowa architektura Course MVP zakłada wykorzystanie Next.js, TypeScript, Route Handlers, Supabase, Tavily, jednego abstrahowanego LLM oraz Vercel.

Aktualna granica produktu kończy się na `accepted claim` → Tavily Search → normalized evidence candidates → Evidence Analysis → `relation + reason` per candidate. Nie zaimplementowano jeszcze syntezy wielu źródeł, finalnego fact-checkingu, Supabase, właściwego `run`, końcowego wyniku ani zapisu historii analiz.

## Uruchomienie lokalne

Instrukcja zostanie uzupełniona po utworzeniu i zweryfikowaniu podstawowego projektu Next.js.
