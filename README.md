# sprawdzarka

`sprawdzarka` to mały program CLI, który ocenia, czy kod realizuje opisane zadanie.
Przykład: podajesz opis agenta AI, który ma łączyć się z pogodą, oraz folder z kodem,
a program zwraca werdykt, czy to połączenie i logika naprawdę są zaimplementowane.

Program używa OpenAI API, Responses API i ustrukturyzowanego wyniku JSON.

## Instalacja

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

Ustaw klucz API:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

Opcjonalnie ustaw model:

```powershell
$env:OPENAI_MODEL="gpt-5.5"
```

## Użycie

Sprawdzenie folderu z kodem:

```powershell
sprawdzarka --task "Agent AI ma odpowiadać na pytania o pogodę, używać prawdziwego API pogody i obsługiwać błędy." --code .\agent
```

Sprawdzenie z wynikiem testów:

```powershell
sprawdzarka --task-file .\zadanie.txt --code .\agent --test-command "pytest"
```

Wynik jako JSON:

```powershell
sprawdzarka --task-file .\zadanie.txt --code .\agent --json
```

## Interfejs w przegladarce

Po instalacji pakietu mozesz uruchomic lokalny interfejs graficzny:

```powershell
sprawdzarka-web --open
```

Albo bez instalowania skryptu:

```powershell
python -m sprawdzarka.web --open
```

Domyslny adres to:

```text
http://127.0.0.1:8765
```

W formularzu wpisz opis zadania, sciezke do folderu lub plikow z kodem oraz opcjonalna
komende testow, np. `pytest`.

## Co sprawdza

- Czy kod odpowiada na opisane wymaganie.
- Czy integracje z narzędziami/API są prawdziwie podłączone, a nie tylko udawane.
- Czy są obsłużone konfiguracja, błędy i przypadki brzegowe.
- Czy testy albo komenda uruchomieniowa potwierdzają działanie.

To nie zastępuje normalnych testów, ale daje szybki audyt semantyczny: czy intencja
zadania zgadza się z tym, co kod faktycznie robi.
