from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable

from openai import OpenAI
from pydantic import BaseModel, Field


DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.5")
TEXT_EXTENSIONS = {
    ".c",
    ".cpp",
    ".cs",
    ".css",
    ".go",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".md",
    ".php",
    ".py",
    ".rb",
    ".rs",
    ".sh",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
SKIP_DIRS = {
    ".git",
    ".idea",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
    "venv",
}


class Finding(BaseModel):
    severity: str = Field(description="One of: blocker, high, medium, low, info.")
    title: str
    evidence: str
    recommendation: str


class AuditReport(BaseModel):
    verdict: str = Field(description="One of: pass, partial, fail, unclear.")
    confidence: float = Field(ge=0, le=1)
    score: int = Field(ge=0, le=100)
    summary: str
    matches_task: list[str]
    missing_or_wrong: list[str]
    tool_connection_assessment: str
    findings: list[Finding]
    suggested_next_steps: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="sprawdzarka",
        description="Check if code satisfies a written task using the OpenAI API.",
    )
    task = parser.add_mutually_exclusive_group(required=True)
    task.add_argument("--task", help="Task/intention to verify.")
    task.add_argument("--task-file", type=Path, help="File containing the task/intention.")
    parser.add_argument(
        "--code",
        type=Path,
        nargs="+",
        required=True,
        help="Code file(s) or folder(s) to inspect.",
    )
    parser.add_argument(
        "--test-command",
        help="Optional command to run and include in the audit, e.g. 'pytest' or 'npm test'.",
    )
    parser.add_argument(
        "--test-cwd",
        type=Path,
        default=Path.cwd(),
        help="Working directory for --test-command. Defaults to the current directory.",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"OpenAI model. Default: {DEFAULT_MODEL}.")
    parser.add_argument(
        "--max-chars",
        type=int,
        default=120_000,
        help="Maximum collected code characters sent to the model.",
    )
    parser.add_argument("--json", action="store_true", help="Print raw JSON report.")
    return parser.parse_args()


def read_task(args: argparse.Namespace) -> str:
    if args.task:
        return args.task.strip()
    return args.task_file.read_text(encoding="utf-8").strip()


def iter_code_files(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        if path.is_file():
            if path.suffix.lower() in TEXT_EXTENSIONS or not path.suffix:
                yield path
            continue
        if not path.is_dir():
            raise FileNotFoundError(f"Code path does not exist: {path}")
        for file_path in path.rglob("*"):
            if any(part in SKIP_DIRS for part in file_path.parts):
                continue
            if file_path.is_file() and file_path.suffix.lower() in TEXT_EXTENSIONS:
                yield file_path


def collect_code(paths: list[Path], max_chars: int) -> str:
    chunks: list[str] = []
    used = 0
    for file_path in sorted(set(iter_code_files(paths))):
        try:
            text = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        header = f"\n\n--- FILE: {file_path} ---\n"
        remaining = max_chars - used - len(header)
        if remaining <= 0:
            break
        if len(text) > remaining:
            text = text[:remaining] + "\n[TRUNCATED]\n"
        chunks.append(header + text)
        used += len(header) + len(text)
    return "".join(chunks).strip()


def run_test_command(command: str | None, cwd: Path) -> str:
    if not command:
        return "No test command was provided."
    completed = subprocess.run(
        command,
        cwd=cwd,
        shell=True,
        text=True,
        capture_output=True,
        timeout=120,
        check=False,
    )
    output = "\n".join(
        [
            f"Command: {command}",
            f"Exit code: {completed.returncode}",
            "STDOUT:",
            completed.stdout.strip(),
            "STDERR:",
            completed.stderr.strip(),
        ]
    )
    return output[-20_000:]


def build_prompt(task: str, code: str, test_output: str) -> list[dict[str, str]]:
    system = (
        "You are a strict but fair senior AI-agent code auditor. Judge whether the submitted "
        "code implements the user's stated task. Focus on concrete evidence from code and test "
        "output. Do not assume external services work unless the code clearly configures and calls "
        "them. For tool-using agents, check whether tools such as weather APIs are actually wired, "
        "validated, called, and handled on failure."
    )
    user = f"""TASK TO VERIFY:
{task}

CODE TO AUDIT:
{code or "[No readable code was collected.]"}

TEST OR RUN OUTPUT:
{test_output}

Return a practical verdict for the developer. Be precise about missing API calls, fake/stubbed
tool connections, broken configuration, weak error handling, and whether the code really satisfies
the task."""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def audit(task: str, code: str, test_output: str, model: str) -> AuditReport:
    client = OpenAI()
    response = client.responses.parse(
        model=model,
        input=build_prompt(task, code, test_output),
        text_format=AuditReport,
        reasoning={"effort": "medium"},
        verbosity="low",
    )

    for item in response.output:
        if item.type != "message":
            continue
        for content in item.content:
            if getattr(content, "type", None) == "refusal":
                raise RuntimeError(f"Model refused the audit: {content.refusal}")
            parsed = getattr(content, "parsed", None)
            if parsed:
                return parsed
    raise RuntimeError("OpenAI response did not contain a parsed audit report.")


def print_human(report: AuditReport) -> None:
    print(f"Werdykt: {report.verdict.upper()} ({report.score}/100, pewnosc {report.confidence:.2f})")
    print(f"\nPodsumowanie:\n{report.summary}")
    print("\nCo pasuje do zadania:")
    for item in report.matches_task or ["Brak mocnych dowodow."]:
        print(f"- {item}")
    print("\nCzego brakuje albo co jest zle:")
    for item in report.missing_or_wrong or ["Brak istotnych brakow wykrytych w audycie."]:
        print(f"- {item}")
    print(f"\nOcena polaczen z narzedziami/API:\n{report.tool_connection_assessment}")
    print("\nZnaleziska:")
    for finding in report.findings or []:
        print(f"- [{finding.severity}] {finding.title}: {finding.evidence}")
        print(f"  Poprawka: {finding.recommendation}")
    print("\nNastepne kroki:")
    for step in report.suggested_next_steps or ["Brak."]:
        print(f"- {step}")


def main() -> int:
    args = parse_args()
    try:
        task = read_task(args)
        code = collect_code(args.code, args.max_chars)
        test_output = run_test_command(args.test_command, args.test_cwd)
        report = audit(task, code, test_output, args.model)
    except Exception as exc:
        print(f"Blad: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report.model_dump(), ensure_ascii=False, indent=2))
    else:
        print_human(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
