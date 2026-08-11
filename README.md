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

Pierwszy pionowy wycinek frontend → backend jest zaimplementowany. Centralny radial hub prowadzi do formularza URL, który wysyła `POST /api/prepare`. Endpoint przygotowuje adres wyłącznie przez backendową walidację i zwraca ustrukturyzowaną odpowiedź JSON. Frontend obsługuje lokalne stany loading, success i error.

`prepare` nie pobiera treści strony i nie wykonuje fact-checkingu. Status `ready` oznacza tylko, że URL przeszedł walidację i może zostać przekazany do przyszłego etapu.

Aktualny endpoint przyjmuje wyłącznie:

```json
{
  "url": "https://example.com/article"
}
```

Użyte technologie w tym wycinku to Next.js, TypeScript i Route Handlers. Walidacja URL ma małe testy uruchamiane wbudowanym mechanizmem Node, bez dodatkowego frameworka testowego.

Docelowa architektura Course MVP zakłada wykorzystanie Next.js, TypeScript, Route Handlers, Supabase, Tavily, jednego abstrahowanego LLM oraz Vercel.

Nie zaimplementowano jeszcze zewnętrznego fetchu, Tavily, LLM, Supabase, Claim Extractora, wyszukiwania źródeł, analizy dowodów, końcowego wyniku ani zapisu historii analiz.

## Uruchomienie lokalne

Instrukcja zostanie uzupełniona po utworzeniu i zweryfikowaniu podstawowego projektu Next.js.
