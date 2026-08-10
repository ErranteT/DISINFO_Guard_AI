# Kontekst produktowy — DISINFO-Guard AI

## Cel dokumentu

Dokument utrwala najważniejsze zasady produktu DISINFO-Guard AI dla Course MVP.

Stanowi źródło prawdy dla decyzji produktowych, sposobu interpretowania wyniku oraz granic funkcjonalnych aplikacji.

## Problem użytkownika

Użytkownik napotyka w internecie lub mediach społecznościowych informację, która budzi wątpliwości albo silne emocje.

Samodzielna weryfikacja wymaga czasu, odnalezienia źródeł i oceny ich jakości.

DISINFO-Guard AI ma wspierać użytkownika w sprawdzeniu jednego konkretnego twierdzenia na podstawie dostępnych materiałów i źródeł.

## Podstawowa zasada produktu

Analizowane jest konkretne twierdzenie, a nie cały artykuł, post lub materiał jako jedna całość.

Przed właściwą analizą użytkownik otrzymuje wyodrębnione twierdzenie i musi je zatwierdzić.

Jeżeli nie uda się uzyskać odpowiedniego twierdzenia do analizy, proces może zakończyć się statusem `claim_unresolved`.

## Co ocenia system

System ocenia stan dostępnych dowodów dotyczących analizowanego twierdzenia.

Nie jest deklarowane ustalenie „prawdy absolutnej”.

Wynik powinien pomagać odpowiedzieć na pytania:

- jakie materiały znaleziono;
- czy wspierają, podważają lub tylko kontekstualizują twierdzenie;
- jak mocne i niezależne są dostępne dowody;
- dlaczego system prezentuje dany wynik.

## Brak dowodów

Brak znalezionego potwierdzenia nie oznacza automatycznie, że twierdzenie jest fałszywe.

Możliwe przyczyny braku dowodów obejmują między innymi:

- bardzo świeże wydarzenie;
- ograniczoną dostępność materiałów;
- problem z dostępem do źródła;
- brak niezależnych publikacji;
- niewystarczającą jakość znalezionych materiałów.

Dlatego `insufficient_data` jest pełnoprawnym i poprawnym wynikiem analizy.

## Model wyniku

Course MVP nie używa procentowego score wiarygodności.

Procentowy wynik został świadomie odrzucony, ponieważ mógłby sugerować matematyczną precyzję lub prawdopodobieństwo prawdy, których system nie jest w stanie rzetelnie zagwarantować.

Wynik ma być komunikowany za pomocą słownego statusu, profilu dowodów, krótkiego uzasadnienia oraz listy wykorzystanych źródeł.

Szczegółowe reguły nadawania statusów należą do backendu, a nie do modelu LLM ani interfejsu użytkownika.

## Rola źródeł

Analiza ma opierać się na rzeczywiście pozyskanych materiałach.

Tavily dostarcza materiały wykorzystywane podczas właściwej analizy.

LLM może interpretować wyłącznie materiały przekazane mu przez backend.

LLM nie może:

- wymyślać źródeł;
- deklarować wykorzystania materiałów, których nie otrzymał;
- samodzielnie nadawać finalnego statusu aplikacji;
- zastępować backendowych reguł wystarczalności dowodów.

## Wejście Course MVP

Jedyną gwarantowaną realną ścieżką wejścia w Course MVP jest URL.

System nie obiecuje obsługi każdego adresu dostępnego w internecie.

Niektóre strony mogą być niedostępne z powodów technicznych, wymagać logowania, blokować automatyczny dostęp albo nie dostarczać wystarczającej treści.

Takie przypadki powinny kończyć się kontrolowanym stanem aplikacji, a nie wymyślonym wynikiem.

## Screenshot i OCR

Rzeczywista analiza screenshotów oraz OCR pozostają poza Course MVP.

Element „Zrzut ekranu” może pozostać częścią koncepcji UX jako przyszła funkcja, ale nie może sugerować działającej analizy obrazu, dopóki funkcjonalność nie zostanie rzeczywiście zaimplementowana.

## UX

Centralny radial hub pozostaje kluczowym elementem koncepcji interfejsu.

Główna akcja powinna znajdować się w centrum, a funkcje poboczne mogą być rozmieszczone promieniście.

Interfejs powinien być:

- spokojny;
- czytelny;
- neutralny;
- zrozumiały dla użytkownika nietechnicznego;
- oparty na dowodach, a nie alarmistycznych komunikatach.

Istniejący prototyp HTML jest referencją UX/UI, a nie bazą techniczną aplikacji.

## Język komunikacji wyniku

Należy unikać komunikatów sugerujących absolutny werdykt, takich jak:

- „To kłamstwo”;
- „To na pewno prawda”;
- „AI ustaliła prawdę”;
- „Wykryto fake news”.

Preferowany jest język opisujący dowody, ich siłę, ograniczenia oraz niepewność.

## Granice Course MVP

Poza bieżącym zakresem pozostają między innymi:

- screenshot/OCR;
- audio i wideo;
- konta użytkowników;
- rozbudowana historia analiz;
- własny crawler;
- własny system RAG;
- wiele modeli LLM;
- procentowe wyniki;
- pełna obsługa każdego rodzaju URL.

Rozszerzenie tych granic wymaga osobnej decyzji produktowej.


## Referencja UX/UI

Plik `docs/references/disinfo-guard-prototype.html` stanowi wizualne i interakcyjne źródło referencyjne dla głównego interfejsu aplikacji.

Przy implementacji docelowej wersji należy zachować przede wszystkim charakter centralnego radial hubu, hierarchię głównej akcji oraz ogólną kompozycję ekranu startowego.

Plik nie jest kodem produkcyjnym ani źródłem prawdy dla logiki aplikacji. Jego demonstracyjna logika, dane i stany nie powinny być kopiowane 1:1 do Course MVP.