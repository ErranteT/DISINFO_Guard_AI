# Rejestr decyzji — DISINFO-Guard AI

## Cel dokumentu

Dokument utrwala najważniejsze decyzje produktowe i techniczne dotyczące Course MVP DISINFO-Guard AI.

Nie jest pełnym dziennikiem zmian ani zbiorem ADR dla każdej drobnej decyzji. Zawiera wyłącznie ustalenia mające istotny wpływ na zakres, architekturę, bezpieczeństwo lub sposób działania systemu.

---

## D-001 — Analizowany jest konkretny claim

### Kontekst

Materiały internetowe mogą zawierać wiele twierdzeń, opinii, komentarzy i elementów emocjonalnych. Ocena całego materiału jako jednej jednostki byłaby nieprecyzyjna.

### Wybrane rozwiązanie

Przedmiotem analizy jest jedno konkretne twierdzenie możliwe do sprawdzenia.

### Główny powód

Pozwala to jednoznacznie określić, czego dotyczą znalezione dowody i końcowy wynik.

### Konsekwencje

- claim musi być jawnie widoczny dla użytkownika;
- użytkownik zatwierdza claim przed właściwą analizą;
- system może zakończyć proces jako `claim_unresolved`.

---

## D-002 — Użytkownik zatwierdza claim przed analizą

### Kontekst

Automatyczne wyodrębnienie twierdzenia może być błędne lub nie odpowiadać temu, co użytkownik rzeczywiście chce sprawdzić.

### Wybrane rozwiązanie

Właściwa analiza dowodów rozpoczyna się dopiero po zatwierdzeniu claimu przez użytkownika.

### Główny powód

Ogranicza ryzyko wykonania kosztownej i mylącej analizy niewłaściwego twierdzenia.

### Konsekwencje

Komunikacja frontend–backend jest podzielona na etap przygotowania claimu i etap właściwej analizy.

---

## D-003 — System ocenia stan dowodów, a nie „prawdę absolutną”

### Kontekst

Na podstawie ograniczonego zbioru materiałów z internetu nie można uczciwie zagwarantować absolutnej prawdziwości lub fałszywości każdego twierdzenia.

### Wybrane rozwiązanie

Wynik opisuje stan i jakość dostępnych dowodów.

### Główny powód

Zmniejsza ryzyko nadmiernego zaufania do aplikacji i lepiej odpowiada rzeczywistym możliwościom systemu.

### Konsekwencje

Należy unikać komunikatów typu „to kłamstwo” lub „AI ustaliła prawdę”.

---

## D-004 — Procentowy score zostaje odrzucony

### Kontekst

W prototypie UX używano procentowej oceny siły dowodów.

### Wybrane rozwiązanie

Course MVP nie używa procentowego score.

### Główny powód

Wartość procentowa sugerowałaby większą matematyczną precyzję niż system może rzetelnie zapewnić.

### Konsekwencje

Wynik jest prezentowany za pomocą słownego statusu, profilu dowodów, uzasadnienia i źródeł.

---

## D-005 — `insufficient_data` jest poprawnym wynikiem

### Kontekst

Brak wystarczających materiałów nie oznacza automatycznie, że analizowane twierdzenie jest fałszywe.

### Wybrane rozwiązanie

System może zakończyć analizę statusem `insufficient_data`.

### Główny powód

Pozwala uczciwie komunikować niepewność i ograniczenia dostępnych danych.

### Konsekwencje

Backend musi posiadać reguły pozwalające odróżnić niewystarczające dane od innych wyników analizy.

---

## D-006 — URL jest jedyną gwarantowaną realną ścieżką wejścia Course MVP

### Kontekst

Prototyp zakładał również screenshot, ale jego rzeczywista obsługa wymagałaby uploadu, OCR i dodatkowej logiki.

### Wybrane rozwiązanie

Course MVP gwarantuje realną analizę wejścia w postaci URL.

Screenshot i OCR pozostają poza zakresem.

### Główny powód

Ogranicza zakres i pozwala ukończyć spójne MVP w terminie kursu.

### Konsekwencje

Interfejs nie może sugerować działającej analizy screenshotów, jeśli nie została faktycznie zaimplementowana.

---

## D-007 — Jeden projekt Next.js

### Kontekst

Frontend i backend można byłoby rozwijać jako osobne aplikacje, ale zwiększyłoby to liczbę elementów infrastruktury i konfiguracji.

### Wybrane rozwiązanie

Aplikacja jest jednym projektem Next.js z TypeScript i Route Handlers.

### Główny powód

Upraszcza architekturę, development, deployment i zarządzanie projektem.

### Konsekwencje

Nie jest planowany osobny backend jako niezależna aplikacja.

---

## D-008 — Backend jest właścicielem procesu i statusów

### Kontekst

Reguły analizy umieszczone w frontendzie lub pozostawione modelowi LLM byłyby trudniejsze do kontrolowania i testowania.

### Wybrane rozwiązanie

Backend odpowiada za orkiestrację, walidację, statusy i reguły wystarczalności dowodów.

### Główny powód

Zapewnia jedno kontrolowane miejsce dla krytycznej logiki biznesowej.

### Konsekwencje

Frontend prezentuje stan zwrócony przez backend, a LLM pełni rolę pomocniczą.

---

## D-009 — Tavily dostarcza rzeczywiste materiały

### Kontekst

Course MVP musi wykonywać realną analizę na podstawie materiałów zewnętrznych, a nie danych demonstracyjnych.

### Wybrane rozwiązanie

Tavily jest usługą odpowiedzialną za pozyskiwanie materiałów używanych podczas właściwej analizy.

### Główny powód

Pozwala ograniczyć zakres projektu bez budowania własnej wyszukiwarki lub crawlera.

### Konsekwencje

Materiały zwrócone przez Tavily nadal muszą być traktowane jako dane niezaufane i interpretowane w kontrolowanym pipeline.

---

## D-010 — LLM działa wyłącznie na dostarczonych materiałach

### Kontekst

Model językowy może generować przekonujące, ale niepoparte źródłami informacje.

### Wybrane rozwiązanie

LLM interpretuje wyłącznie materiały przekazane przez backend.

Nie może wymyślać źródeł ani deklarować wykorzystania materiałów, których nie otrzymał.

### Główny powód

Ogranicza ryzyko halucynacji źródeł i umożliwia audyt wyniku.

### Konsekwencje

Wynik LLM musi zostać zwalidowany przed dalszym użyciem.

---

## D-011 — Jeden LLM za warstwą abstrakcji

### Kontekst

Silne powiązanie kodu z jednym providerem utrudniłoby późniejszą zmianę modelu.

Jednocześnie obsługa wielu modeli w Course MVP nie jest potrzebna.

### Wybrane rozwiązanie

Używany jest jeden aktywny LLM ukryty za prostą warstwą abstrakcji.

### Główny powód

Pozwala zachować elastyczność bez zwiększania zakresu MVP.

### Konsekwencje

Konkretny provider i model mogą zostać wybrane później bez przebudowy całego pipeline.

---

## D-012 — Minimalny model danych obejmuje dwie tabele

### Kontekst

Trzeba przechować zarówno pojedynczą analizę, jak i wiele powiązanych z nią materiałów dowodowych.

### Wybrane rozwiązanie

Minimalny model Supabase obejmuje:

- `analyses`;
- `evidence`.

### Główny powód

Rozdziela wynik procesu od materiałów wykorzystanych w jego przygotowaniu, zachowując prostą relację 1:N.

### Konsekwencje

Dokładne kolumny i typy zostaną ustalone przed utworzeniem schematu bazy.

---

## D-013 — Supabase jako warstwa danych

### Kontekst

Course MVP potrzebuje relacyjnego backendu danych i musi również umożliwić wykonanie zadań kursowych dotyczących bazy.

### Wybrane rozwiązanie

Zastosowany zostaje Supabase.

### Główny powód

Zapewnia relacyjną bazę danych oraz prostą integrację odpowiednią dla skali Course MVP.

### Konsekwencje

Integracja z Supabase zostanie wykonana dopiero w odpowiednim etapie backendowym.

---

## D-014 — Vercel jako platforma deploymentu

### Kontekst

Projekt jest oparty na Next.js i wymaga późniejszego CI/CD, konfiguracji środowiska produkcyjnego oraz testu rollbacku.

### Wybrane rozwiązanie

Docelową platformą deploymentu jest Vercel.

### Główny powód

Zapewnia prostą integrację z Next.js i GitHub oraz mechanizmy potrzebne do realizacji zadania kursowego.

### Konsekwencje

Deployment zostanie skonfigurowany dopiero po uzyskaniu stabilnej aplikacji.

---

## D-015 — Radial hub pozostaje główną zasadą UX

### Kontekst

Istniejący prototyp HTML jest tylko referencją techniczną, ale zawiera rozpoznawalny centralny model nawigacji.

### Wybrane rozwiązanie

Zachowany zostaje centralny radial hub z główną akcją w centrum i funkcjami pobocznymi rozmieszczonymi wokół niej.

### Główny powód

Jest to kluczowy element zatwierdzonej koncepcji produktu.

### Konsekwencje

Nie należy przebudowywać tego modelu UX bez osobnej decyzji produktowej.

---

## D-016 — Repozytorium aplikacji i dokumentacja kursowa są rozdzielone

### Kontekst

Materiały kursowe mogą zawierać prywatne prompty, odpowiedzi formularzowe, raporty i inne dane, które nie powinny automatycznie trafiać do repozytorium aplikacji.

### Wybrane rozwiązanie

Utrzymywane są dwa osobne katalogi:

- repozytorium aplikacji;
- prywatna dokumentacja kursowa.

### Główny powód

Chroni prywatne materiały kursowe i utrzymuje repozytorium produktu w czystym stanie.

### Konsekwencje

Dokumentacja kursowa nie jest kopiowana do repozytorium aplikacji bez świadomej decyzji.

---

## D-017 — Sekrety nigdy nie trafiają do repozytorium

### Kontekst

Projekt będzie korzystał z zewnętrznych usług wymagających kluczy i danych dostępowych.

### Wybrane rozwiązanie

Sekrety są przechowywane wyłącznie w lokalnych lub hostingowych zmiennych środowiskowych.

Repozytorium zawiera tylko bezpieczny `.env.example` bez tajnych wartości.

### Główny powód

Ogranicza ryzyko wycieku kluczy przez kod lub historię Git.

### Konsekwencje

Przed pierwszym commitem i przed kolejnymi istotnymi etapami należy kontrolować status Git i ignorowane pliki.

---

## D-018 — Najpierw małe, weryfikowalne kroki

### Kontekst

Duże polecenia dla agenta zwiększają ryzyko niekontrolowanych zmian, context rot i odejścia od zatwierdzonej architektury.

### Wybrane rozwiązanie

Implementacja jest dzielona na małe zadania z określonym zakresem, kryteriami akceptacji i sposobem weryfikacji.

### Główny powód

Ułatwia kontrolę zmian, testowanie, naukę i późniejsze wykonanie zadania kursowego dotyczącego dekompozycji.

### Konsekwencje

Codex nie powinien otrzymywać poleceń typu „zbuduj całą aplikację”.

---

## D-019 — `prepare` jest minimalnym etapem backendowego przygotowania URL

### Kontekst

Pierwszy pionowy wycinek ma połączyć interfejs z backendem bez rozpoczynania analizy materiału ani integracji zewnętrznych.

### Wybrane rozwiązanie

Endpoint `POST /api/prepare` przyjmuje wyłącznie `{ url: string }`. Route Handler odpowiada za HTTP, a osobny walidator URL za reguły wejścia. Poprawny adres zwraca `200` i status `ready`; błędy wejścia zwracają `400` ze statusem `invalid_input`, a nieoczekiwane błędy `500` ze statusem `error`.

Walidator blokuje oczywiste adresy lokalne, ale pełna ochrona SSRF zostaje odłożona do etapu realnego fetchu. Testy walidatora używają wbudowanego mechanizmu Node, bez dodawania frameworka testowego.

### Główny powód

Zapewnia mały, testowalny kontrakt frontend → backend i zachowuje backendową własność walidacji oraz statusów.

### Konsekwencje

`ready` oznacza wyłącznie gotowość URL do przyszłego etapu. Endpoint nie pobiera stron, nie wykonuje fact-checkingu, nie wyodrębnia claimu, nie wyszukuje źródeł i nie korzysta z Tavily, LLM ani Supabase.

---

## D-020 — SAFE FETCH przygotowuje kontrolowany tekst z publicznego URL

### Kontekst

Etap 04 rozszerza wcześniejszą walidację o rzeczywiste pobranie materiału bez budowania general-purpose scrapera.

### Wybrane rozwiązanie

`POST /api/prepare` używa Node.js Runtime i kontrolowanego transportu HTTP/HTTPS. Wszystkie wyniki DNS muszą być publiczne, a zaakceptowany adres jest związany z requestem przez `lookup`. Redirecty są ręczne i ponownie walidowane. Obsługiwane są wyłącznie nieskompresowane `text/html` i `text/plain` w UTF-8, z limitem 10 sekund na request, 2 MB body i 3 redirectów. Minimalne parsowanie HTML wykonuje `parse5`.

### Główny powód

Pozwala bezpiecznie przygotować tekst dla przyszłego Claim Extractora, ograniczając SSRF, DNS rebinding, niekontrolowane redirecty i nadmierne odpowiedzi.

### Konsekwencje

`ready` oznacza teraz przygotowany tekst. SAFE FETCH nie renderuje JavaScriptu, nie wybiera głównego artykułu, nie odczytuje metadanych i nie wykonuje żadnej analizy AI.

---

## D-021 — Claim Extractor używa jednego modelu Groq i backendowej walidacji

### Kontekst

Etap 05 rozszerza `/api/prepare` o pierwszy rzeczywisty request backend → LLM, ale kończy się przed wyszukiwaniem evidence i właściwym `run`.

### Wybrane rozwiązanie

Backend przekazuje maksymalnie pierwsze 15 000 znaków przygotowanego tekstu jako niezaufane dane do Groq Cloud, model `openai/gpt-oss-20b`, przez zgodne z OpenAI Chat Completions API i strict JSON Schema. Odpowiedź jest niezależnie walidowana w backendzie. Malformed output ma jeden technical retry. Poprawny claim daje `claim_pending`, a `no_claim` natychmiast daje `claim_unresolved`.

Frontend przechowuje licznik prób i odrzucone claimy. Reject może wywołać ponowny `/api/prepare` i SAFE FETCH dla próby 2 lub 3; trzecie odrzucenie kończy flow. Accept tylko potwierdza claim jako gotowy do przyszłego `run` i nie tworzy nowego statusu API.

### Główny powód

Zapewnia mały, testowalny pion Claim Flow z jednym providerem i modelem, bez wprowadzania persistence, Tavily ani pipeline evidence.

### Konsekwencje

- pełny prepared text nie opuszcza backendu;
- `GROQ_API_KEY` jest wyłącznie backendową zmienną środowiskową;
- materiał nie może sterować instrukcją Extractora ani być uzupełniany wiedzą zewnętrzną;
- identyczny odrzucony claim jest blokowany prostą normalizacją tekstową;
- limit prób nie jest security boundary odporną na ręczne manipulowanie requestem;
- Tavily, evidence, `run`, finalny fact-check i Supabase pozostają poza tym etapem.

---

## D-022 — Evidence retrieval używa wyłącznie Tavily Search i backendowej normalizacji

### Kontekst

Etap 06 ma pozyskać rzeczywiste materiały dla zaakceptowanego claimu, ale kończy się przed ich interpretacją i finalnym fact-checkingiem.

### Wybrane rozwiązanie

Po ręcznym CTA backendowy `POST /api/evidence` ponownie waliduje claim i wykonuje natywnym `fetch` jeden `POST https://api.tavily.com/search`. Query jest wyłącznie zaakceptowany claim, a parametry Search są stałe: `basic`, `general`, maksymalnie 5 wyników, bez answer, raw content i obrazów. Backend normalizuje wyniki do `url`, `title`, `content` i `retrievalScore`.

### Główny powód

Zapewnia mały, audytowalny i testowalny etap retrieval bez Tavily Extract, SDK, LLM, warstwy multi-provider ani przedwczesnej analizy dowodów.

### Konsekwencje

- `TAVILY_API_KEY` jest wyłącznie backendową zmienną środowiskową;
- poprawna odpowiedź bez użytecznych wyników zwraca `{ "candidates": [] }`;
- błędy techniczne providera nie są zamieniane na pustą listę;
- `retrievalScore` oznacza tylko dopasowanie wyszukiwarki i nie jest scoringiem wiarygodności;
- Evidence Analyst, relacje supports/contradicts/context, `insufficient_data` i finalny fact-check pozostają poza etapem 06.
