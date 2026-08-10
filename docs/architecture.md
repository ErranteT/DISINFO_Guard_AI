# Architektura — DISINFO-Guard AI

## Cel dokumentu

Dokument opisuje zatwierdzoną architekturę logiczną Course MVP DISINFO-Guard AI.

Stanowi źródło prawdy dla implementacji technicznej i określa granice odpowiedzialności poszczególnych elementów systemu.

Dokument nie oznacza, że wszystkie opisane elementy zostały już zaimplementowane.

## Stan obecny

Projekt znajduje się na etapie przygotowania fundamentu technicznego.

Na tym etapie:

- nie działa jeszcze pipeline analizy;
- Supabase nie jest jeszcze zintegrowany;
- Tavily nie jest jeszcze zintegrowane;
- LLM nie jest jeszcze podłączony;
- właściwe endpointy aplikacji nie są jeszcze zaimplementowane;
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

## Główny przepływ Course MVP

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