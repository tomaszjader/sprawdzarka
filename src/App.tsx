import { useEffect, useMemo, useState } from "react";
import type { AuditReport, Finding, Verdict } from "./types";

interface AuditForm {
  task: string;
  codePaths: string;
  testCommand: string;
  testCwd: string;
  model: string;
  maxChars: number;
}

const initialForm: AuditForm = {
  task: "",
  codePaths: "",
  testCommand: "",
  testCwd: "",
  model: "",
  maxChars: 120_000
};

const verdictLabels: Record<Verdict, string> = {
  pass: "PASS",
  partial: "PARTIAL",
  fail: "FAIL",
  unclear: "UNCLEAR"
};

export default function App() {
  const [form, setForm] = useState<AuditForm>(initialForm);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const codePaths = useMemo(
    () =>
      form.codePaths
        .replaceAll(",", "\n")
        .split("\n")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean),
    [form.codePaths]
  );

  useEffect(() => {
    void fetch("/api/config")
      .then((response) => response.json())
      .then((data: { defaultModel?: string }) => {
        setForm((current) => ({ ...current, model: data.defaultModel ?? current.model }));
      })
      .catch(() => undefined);
  }, []);

  function updateField<K extends keyof AuditForm>(key: K, value: AuditForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: form.task,
          codePaths,
          testCommand: form.testCommand || undefined,
          testCwd: form.testCwd || undefined,
          model: form.model || undefined,
          maxChars: Number(form.maxChars || 120_000)
        })
      });

      const data = (await response.json()) as { report?: AuditReport; error?: string };
      if (!response.ok || !data.report) {
        throw new Error(data.error || "Nie udalo sie wykonac audytu.");
      }

      setReport(data.report);
    } catch (submitError) {
      setReport(null);
      setError(submitError instanceof Error ? submitError.message : "Nieznany blad.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="topbar">
          <h1>Sprawdzarka</h1>
          <p>Lokalny audyt kodu przez OpenAI API</p>
        </div>
      </header>

      <main className="layout">
        <form className="audit-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Zadanie do sprawdzenia</span>
            <textarea
              required
              value={form.task}
              onChange={(event) => updateField("task", event.target.value)}
              placeholder="Np. Agent AI ma uzywac prawdziwego API pogody i obslugiwac bledy."
            />
          </label>

          <label className="field">
            <span>Sciezki do kodu</span>
            <input
              required
              value={form.codePaths}
              onChange={(event) => updateField("codePaths", event.target.value)}
              placeholder="Np. C:\\projekty\\agent albo .\\agent"
            />
            <small>Kilka sciezek oddziel przecinkiem albo wpisz kazda w nowej linii.</small>
          </label>

          <label className="field">
            <span>Komenda testow</span>
            <input
              value={form.testCommand}
              onChange={(event) => updateField("testCommand", event.target.value)}
              placeholder="Np. pytest albo npm test"
            />
          </label>

          <label className="field">
            <span>Folder uruchomienia testow</span>
            <input
              value={form.testCwd}
              onChange={(event) => updateField("testCwd", event.target.value)}
              placeholder="Domyslnie: folder serwera"
            />
          </label>

          <div className="split-fields">
            <label className="field">
              <span>Model</span>
              <input value={form.model} onChange={(event) => updateField("model", event.target.value)} />
            </label>

            <label className="field">
              <span>Limit znakow</span>
              <input
                min={1000}
                step={1000}
                type="number"
                value={form.maxChars}
                onChange={(event) => updateField("maxChars", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="actions">
            <button disabled={isLoading || codePaths.length === 0} type="submit">
              {isLoading ? "Sprawdzam..." : "Sprawdz"}
            </button>
            <span>{isLoading ? "Audyt trwa" : "Gotowe"}</span>
          </div>
        </form>

        <section className={error ? "result-panel error" : "result-panel"}>
          {error ? <ErrorView message={error} /> : report ? <ReportView report={report} /> : <EmptyView />}
        </section>
      </main>
    </>
  );
}

function EmptyView() {
  return <div className="empty">Wypelnij formularz i uruchom audyt.</div>;
}

function ErrorView({ message }: { message: string }) {
  return (
    <>
      <h2>Blad</h2>
      <p>{message}</p>
    </>
  );
}

function ReportView({ report }: { report: AuditReport }) {
  return (
    <>
      <div className="verdict">
        <div>
          <h2>Werdykt: {verdictLabels[report.verdict]}</h2>
          <p>{report.summary}</p>
        </div>
        <div className="score">
          {report.score}/100
          <span>pewnosc {report.confidence.toFixed(2)}</span>
        </div>
      </div>

      <ReportSection title="Co pasuje do zadania" items={report.matches_task} fallback="Brak mocnych dowodow." />
      <ReportSection
        title="Czego brakuje albo co jest zle"
        items={report.missing_or_wrong}
        fallback="Brak istotnych brakow wykrytych w audycie."
      />

      <section>
        <h3>Ocena narzedzi/API</h3>
        <p>{report.tool_connection_assessment}</p>
      </section>

      <section>
        <h3>Znaleziska</h3>
        {report.findings.length ? report.findings.map((finding) => <FindingCard finding={finding} key={finding.title} />) : <p>Brak znalezisk.</p>}
      </section>

      <ReportSection title="Nastepne kroki" items={report.suggested_next_steps} fallback="Brak." />

      <section>
        <h3>JSON</h3>
        <pre className="json-box">{JSON.stringify(report, null, 2)}</pre>
      </section>
    </>
  );
}

function ReportSection({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  const visibleItems = items.length ? items : [fallback];
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {visibleItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="finding">
      <strong>
        <span className="severity">{finding.severity}</span> {finding.title}
      </strong>
      <p>{finding.evidence}</p>
      <p>
        <b>Poprawka:</b> {finding.recommendation}
      </p>
    </article>
  );
}
