from __future__ import annotations

import argparse
import json
import sys
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .cli import DEFAULT_MODEL, audit, collect_code, run_test_command


INDEX_HTML = """<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sprawdzarka</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7f9;
      --panel: #ffffff;
      --text: #1b1f24;
      --muted: #65717f;
      --line: #d9e0e7;
      --accent: #0f766e;
      --accent-dark: #115e59;
      --danger: #b42318;
      --warn: #a15c07;
      --ok: #137333;
      --code: #111827;
      --code-bg: #eef2f6;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }

    header {
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }

    .topbar, main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 68px;
      gap: 16px;
    }

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 740;
      letter-spacing: 0;
    }

    .api-state {
      color: var(--muted);
      font-size: 14px;
    }

    main {
      display: grid;
      grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
      gap: 20px;
      padding: 20px 0 36px;
    }

    form, .result-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      min-width: 0;
    }

    form {
      padding: 18px;
      height: fit-content;
      position: sticky;
      top: 16px;
    }

    .field {
      display: grid;
      gap: 7px;
      margin-bottom: 14px;
    }

    label {
      font-size: 13px;
      font-weight: 680;
      color: #29313a;
    }

    textarea, input {
      width: 100%;
      border: 1px solid #c8d1dc;
      border-radius: 6px;
      padding: 10px 11px;
      font: inherit;
      color: var(--text);
      background: #fff;
      outline: none;
    }

    textarea {
      min-height: 142px;
      resize: vertical;
    }

    input:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 120px;
      gap: 10px;
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 18px;
    }

    button {
      border: 0;
      border-radius: 6px;
      min-height: 42px;
      padding: 0 15px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-weight: 720;
      cursor: pointer;
    }

    button:hover { background: var(--accent-dark); }
    button:disabled { cursor: wait; opacity: 0.7; }

    .hint, .status {
      color: var(--muted);
      font-size: 13px;
    }

    .result-panel {
      padding: 18px;
      overflow: hidden;
    }

    .empty {
      color: var(--muted);
      display: grid;
      place-items: center;
      min-height: 300px;
      text-align: center;
    }

    .verdict {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 16px;
    }

    .verdict h2 {
      margin: 0 0 6px;
      font-size: 22px;
      letter-spacing: 0;
    }

    .score {
      min-width: 86px;
      text-align: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fafafa;
      font-weight: 760;
    }

    .score span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }

    section {
      margin-top: 18px;
    }

    h3 {
      margin: 0 0 8px;
      font-size: 15px;
      letter-spacing: 0;
    }

    ul {
      margin: 0;
      padding-left: 20px;
    }

    li + li { margin-top: 6px; }

    .finding {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      margin-top: 10px;
      background: #fcfcfd;
    }

    .finding strong {
      display: block;
      margin-bottom: 5px;
    }

    .severity {
      color: var(--danger);
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0;
    }

    .json-box {
      white-space: pre-wrap;
      overflow: auto;
      max-height: 380px;
      background: var(--code-bg);
      color: var(--code);
      padding: 12px;
      border-radius: 8px;
      font: 13px ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    }

    .error {
      border-color: #f0b7b2;
      background: #fff5f5;
      color: var(--danger);
    }

    @media (max-width: 860px) {
      main { grid-template-columns: 1fr; }
      form { position: static; }
      .topbar { align-items: flex-start; flex-direction: column; padding: 14px 0; }
      .row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <h1>Sprawdzarka</h1>
      <div class="api-state">Interfejs lokalny do audytu kodu przez OpenAI API</div>
    </div>
  </header>
  <main>
    <form id="audit-form">
      <div class="field">
        <label for="task">Zadanie do sprawdzenia</label>
        <textarea id="task" name="task" required placeholder="Np. Agent AI ma uzywac prawdziwego API pogody i obslugiwac bledy."></textarea>
      </div>
      <div class="field">
        <label for="code_paths">Sciezki do kodu</label>
        <input id="code_paths" name="code_paths" required placeholder="Np. C:\\projekty\\agent albo .\\agent">
        <div class="hint">Kilka sciezek oddziel przecinkiem lub wpisz kazda w nowej linii.</div>
      </div>
      <div class="field">
        <label for="test_command">Komenda testow</label>
        <input id="test_command" name="test_command" placeholder="Np. pytest albo npm test">
      </div>
      <div class="field">
        <label for="test_cwd">Folder uruchomienia testow</label>
        <input id="test_cwd" name="test_cwd" placeholder="Domyslnie: aktualny folder serwera">
      </div>
      <div class="row">
        <div class="field">
          <label for="model">Model</label>
          <input id="model" name="model" value="__DEFAULT_MODEL__">
        </div>
        <div class="field">
          <label for="max_chars">Limit znakow</label>
          <input id="max_chars" name="max_chars" type="number" min="1000" step="1000" value="120000">
        </div>
      </div>
      <div class="actions">
        <button id="submit-button" type="submit">Sprawdz</button>
        <div id="status" class="status">Gotowe</div>
      </div>
    </form>
    <div id="result" class="result-panel">
      <div class="empty">Wypelnij formularz i uruchom audyt.</div>
    </div>
  </main>
  <script>
    const form = document.querySelector("#audit-form");
    const button = document.querySelector("#submit-button");
    const statusBox = document.querySelector("#status");
    const resultBox = document.querySelector("#result");

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function list(items, fallback) {
      const safeItems = items && items.length ? items : [fallback];
      return `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }

    function renderReport(report) {
      const findings = report.findings && report.findings.length
        ? report.findings.map((finding) => `
          <div class="finding">
            <strong><span class="severity">${escapeHtml(finding.severity)}</span> ${escapeHtml(finding.title)}</strong>
            <div>${escapeHtml(finding.evidence)}</div>
            <div><b>Poprawka:</b> ${escapeHtml(finding.recommendation)}</div>
          </div>
        `).join("")
        : "<p>Brak znalezisk.</p>";

      resultBox.className = "result-panel";
      resultBox.innerHTML = `
        <div class="verdict">
          <div>
            <h2>Werdykt: ${escapeHtml(String(report.verdict).toUpperCase())}</h2>
            <div>${escapeHtml(report.summary)}</div>
          </div>
          <div class="score">${escapeHtml(report.score)}/100<span>pewnosc ${escapeHtml(report.confidence)}</span></div>
        </div>
        <section>
          <h3>Co pasuje do zadania</h3>
          ${list(report.matches_task, "Brak mocnych dowodow.")}
        </section>
        <section>
          <h3>Czego brakuje albo co jest zle</h3>
          ${list(report.missing_or_wrong, "Brak istotnych brakow wykrytych w audycie.")}
        </section>
        <section>
          <h3>Ocena narzedzi/API</h3>
          <p>${escapeHtml(report.tool_connection_assessment)}</p>
        </section>
        <section>
          <h3>Znaleziska</h3>
          ${findings}
        </section>
        <section>
          <h3>Nastepne kroki</h3>
          ${list(report.suggested_next_steps, "Brak.")}
        </section>
        <section>
          <h3>JSON</h3>
          <pre class="json-box">${escapeHtml(JSON.stringify(report, null, 2))}</pre>
        </section>
      `;
    }

    function renderError(message) {
      resultBox.className = "result-panel error";
      resultBox.innerHTML = `<strong>Blad</strong><p>${escapeHtml(message)}</p>`;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      statusBox.textContent = "Sprawdzam...";

      const payload = Object.fromEntries(new FormData(form).entries());
      payload.max_chars = Number(payload.max_chars || 120000);

      try {
        const response = await fetch("/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Nie udalo sie wykonac audytu.");
        }
        renderReport(data.report);
        statusBox.textContent = "Gotowe";
      } catch (error) {
        renderError(error.message);
        statusBox.textContent = "Blad";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>
""".replace("__DEFAULT_MODEL__", DEFAULT_MODEL)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="sprawdzarka-web",
        description="Run a local browser UI for sprawdzarka.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind. Default: 127.0.0.1.")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind. Default: 8765.")
    parser.add_argument("--open", action="store_true", help="Open the browser after starting.")
    return parser.parse_args()


def split_paths(raw: str) -> list[Path]:
    parts = []
    for line in raw.replace(",", "\n").splitlines():
        item = line.strip().strip('"')
        if item:
            parts.append(Path(item))
    return parts


class SprawdzarkaHandler(BaseHTTPRequestHandler):
    server_version = "SprawdzarkaWeb/0.1"

    def do_GET(self) -> None:
        if self.path not in {"/", "/index.html"}:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(INDEX_HTML.encode("utf-8"))

    def do_POST(self) -> None:
        if self.path != "/audit":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        try:
            payload = self.read_json()
            report = self.run_audit(payload)
        except Exception as exc:
            self.write_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        self.write_json({"report": report.model_dump()})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}", file=sys.stderr)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            raise ValueError("Brak danych formularza.")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def run_audit(self, payload: dict[str, Any]):
        task = str(payload.get("task", "")).strip()
        if not task:
            raise ValueError("Wpisz zadanie do sprawdzenia.")

        code_paths = split_paths(str(payload.get("code_paths", "")))
        if not code_paths:
            raise ValueError("Podaj przynajmniej jedna sciezke do kodu.")

        test_command = str(payload.get("test_command", "")).strip() or None
        test_cwd_raw = str(payload.get("test_cwd", "")).strip()
        test_cwd = Path(test_cwd_raw) if test_cwd_raw else Path.cwd()
        model = str(payload.get("model", "")).strip() or DEFAULT_MODEL
        max_chars = int(payload.get("max_chars") or 120_000)

        code = collect_code(code_paths, max_chars)
        test_output = run_test_command(test_command, test_cwd)
        return audit(task, code, test_output, model)

    def write_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), SprawdzarkaHandler)
    url = f"http://{args.host}:{args.port}"
    print(f"Sprawdzarka web dziala pod adresem: {url}")
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nZatrzymano serwer.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
