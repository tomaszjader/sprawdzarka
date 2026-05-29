# Sprawdzarka

`sprawdzarka` to lokalna aplikacja React + TypeScript, która sprawdza, czy kod realizuje opisane zadanie.
Podajesz opis wymagania, ścieżkę do folderu lub plików z kodem i opcjonalną komendę testów, a aplikacja zwraca ustrukturyzowany werdykt.

Backend działa w Node.js. Czyta lokalne pliki, może uruchomić wskazaną komendę testową i wysyła audyt do OpenAI Responses API.
Frontend jest napisany w React i TypeScript.

## Wymagania

- Node.js
- npm
- klucz `OPENAI_API_KEY`

## Instalacja

```powershell
npm install
```

Ustaw klucz API:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

Opcjonalnie ustaw model:

```powershell
$env:OPENAI_MODEL="gpt-5.5"
```

## Uruchomienie developerskie

```powershell
npm run dev
```

Domyślne adresy:

```text
Frontend: http://127.0.0.1:5173
Backend:  http://127.0.0.1:8765
```

Jeśli port backendu jest zajęty, uruchom aplikację na innym porcie:

```powershell
$env:PORT="8766"
$env:BACKEND_PORT="8766"
npm run dev
```

## Build i start produkcyjny

```powershell
npm run build
npm start
```

Po starcie produkcyjnym aplikacja jest dostępna pod adresem:

```text
http://127.0.0.1:8765
```

## Jak używać

1. W polu `Zadanie do sprawdzenia` opisz wymaganie, które kod miał spełnić.
2. W polu `Ścieżki do kodu` podaj jeden lub kilka folderów albo plików. Kilka ścieżek oddziel przecinkiem lub wpisz każdą w nowej linii.
3. Opcjonalnie wpisz `Komendę testów`, np. `npm test`, `pytest` albo `npm run typecheck`.
4. Jeśli testy mają ruszyć z innego katalogu, uzupełnij `Folder uruchomienia testów`.
5. Uruchom audyt i przeczytaj werdykt, listę braków, ocenę integracji z narzędziami/API oraz sugerowane następne kroki.

## Dostępne komendy

```powershell
npm run dev        # backend i frontend w trybie developerskim
npm run dev:server # tylko backend
npm run dev:client # tylko frontend
npm run build      # typecheck i build frontendu
npm run start      # start wersji produkcyjnej
npm run typecheck  # sprawdzenie typów TypeScript
```

## Co sprawdza audyt

- Czy kod odpowiada na opisane wymaganie.
- Czy integracje z narzędziami i API są prawdziwie podłączone, a nie tylko zasymulowane.
- Czy obsłużono konfigurację, błędy i przypadki brzegowe.
- Czy testy albo komenda uruchomieniowa potwierdzają działanie.

To nie zastępuje normalnych testów, ale daje szybki audyt semantyczny: czy intencja zadania zgadza się z tym, co kod faktycznie robi.
