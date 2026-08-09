# AGENTS.md — DISINFO-Guard AI

## Cel

Ten plik zawiera stałe zasady pracy dla agentów kodujących pracujących w repozytorium DISINFO-Guard AI.

Repozytorium oraz dokumentacja w `docs/` są źródłem prawdy o aktualnym stanie produktu i architektury.

Nie należy traktować pamięci poprzedniej sesji jako nadrzędnego źródła informacji.

## Źródła prawdy

Przed większą zmianą należy sprawdzić co najmniej:

- `README.md`
- `docs/product-context.md`
- `docs/architecture.md`
- `docs/decisions.md`
- aktualny kod
- aktualny stan Git

Jeżeli kod i dokumentacja są ze sobą sprzeczne, należy zgłosić rozbieżność przed dalszą implementacją.

## Zakres Course MVP

Nie wolno samodzielnie rozszerzać zakresu Course MVP.

W szczególności bez osobnej decyzji nie należy implementować:

- screenshot/OCR;
- analizy audio lub wideo;
- kont użytkowników;
- rozbudowanej historii analiz;
- własnego crawlera;
- własnego systemu RAG;
- wielu providerów LLM działających równolegle;
- procentowego scoringu wiarygodności.

URL jest jedyną gwarantowaną realną ścieżką wejścia Course MVP.

## Architektura

Zatwierdzona architektura Course MVP zakłada:

- Next.js;
- TypeScript;
- Route Handlers;
- Supabase;
- Tavily;
- jeden aktywny LLM za prostą warstwą abstrakcji;
- Vercel.

Backend jest właścicielem:

- walidacji;
- orkiestracji procesu;
- statusów;
- reguł wystarczalności dowodów;
- komunikacji z usługami zewnętrznymi;
- finalnego stanu analizy.

Frontend nie może samodzielnie ustalać finalnych statusów analizy.

LLM nie może samodzielnie ustalać finalnego statusu aplikacji.

## Granice LLM

LLM może interpretować wyłącznie materiały przekazane mu przez backend.

Nie wolno projektować rozwiązania, w którym LLM:

- wymyśla źródła;
- powołuje się na materiały, których nie otrzymał;
- obchodzi kontrolowaną integrację z Tavily;
- zastępuje backendowe reguły biznesowe;
- podejmuje autonomiczne decyzje o finalnym statusie analizy.

Odpowiedź LLM musi zostać zwalidowana przed użyciem.

## Bezpieczeństwo i sekrety

Nigdy nie należy:

- wpisywać kluczy API bezpośrednio do kodu;
- zapisywać prawdziwych sekretów w repozytorium;
- umieszczać sekretów w dokumentacji;
- zwracać sekretów do frontendu;
- commitować lokalnych plików `.env`.

Repozytorium może zawierać `.env.example` wyłącznie z nazwami zmiennych i bez tajnych wartości.

Jeżeli podczas pracy zostanie wykryty potencjalny sekret w kodzie, staging area lub historii Git, należy zatrzymać pracę i zgłosić ryzyko.

Nie należy samodzielnie wykonywać destrukcyjnych operacji naprawczych w Git.

## Git

Przed większą zmianą należy sprawdzić:

```text
git status