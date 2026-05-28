# Sprawdzarka

`sprawdzarka` to lokalna aplikacja React + TypeScript, która ocenia, czy kod realizuje opisane zadanie.
Podajesz opis wymagania, ścieżkę do folderu lub plików z kodem i opcjonalną komendę testów, a aplikacja zwraca ustrukturyzowany werdykt.

Backend działa w Node.js, czyta lokalne pliki, może uruchomić testy i wysyła audyt do OpenAI Responses API.
Frontend jest napisany w React i TypeScript.

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

## Uruchomienie w trybie developerskim

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

## Co sprawdza

- Czy kod odpowiada na opisane wymaganie.
- Czy integracje z narzędziami/API są prawdziwie podłączone, a nie tylko udawane.
- Czy są obsłużone konfiguracja, błędy i przypadki brzegowe.
- Czy testy albo komenda uruchomieniowa potwierdzają działanie.

To nie zastępuje normalnych testów, ale daje szybki audyt semantyczny: czy intencja zadania zgadza się z tym, co kod faktycznie robi.
