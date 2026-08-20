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

Pionowy wycinek frontend → backend obejmuje obecnie SAFE FETCH. Centralny radial hub prowadzi do formularza URL, który wysyła `POST /api/prepare`. Backend waliduje adres, kontroluje DNS/IP, ręcznie obsługuje przekierowania, pobiera publicznie dostępny materiał HTML lub plain text i przygotowuje znormalizowany tekst. Frontend obsługuje stany loading, success i error.

Status `ready` oznacza, że materiał został pobrany i przygotowany. Nie oznacza wyodrębnienia claimu ani wykonania fact-checkingu.

Aktualny endpoint przyjmuje wyłącznie:

```json
{
  "url": "https://example.com/article"
}
```

Obsługiwane są wyłącznie odpowiedzi `text/html` i `text/plain` w UTF-8, bez kompresji transportowej. Pojedynczy request ma limit 10 sekund, body limit 2 MB, a łańcuch może zawierać maksymalnie 3 ręcznie walidowane redirecty. HTML jest parsowany przez `parse5`; usuwane są `script`, `style` i `noscript`, bez Readability i bez wyboru głównego artykułu.

Użyte technologie w tym wycinku to Next.js, TypeScript, Route Handlers i `parse5`. Testy używają wbudowanego mechanizmu Node, bez dodatkowego frameworka testowego i bez publicznego internetu.

Docelowa architektura Course MVP zakłada wykorzystanie Next.js, TypeScript, Route Handlers, Supabase, Tavily, jednego abstrahowanego LLM oraz Vercel.

Nie zaimplementowano jeszcze Tavily, LLM, Supabase, Claim Extractora, wyszukiwania źródeł, analizy dowodów, końcowego wyniku ani zapisu historii analiz.

## Uruchomienie lokalne

Instrukcja zostanie uzupełniona po utworzeniu i zweryfikowaniu podstawowego projektu Next.js.
