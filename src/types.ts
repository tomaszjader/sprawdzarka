export type Severity = "blocker" | "high" | "medium" | "low" | "info";
export type Verdict = "pass" | "partial" | "fail" | "unclear";

export interface Finding {
  severity: Severity;
  title: string;
  evidence: string;
  recommendation: string;
}

export interface AuditReport {
  verdict: Verdict;
  confidence: number;
  score: number;
  summary: string;
  matches_task: string[];
  missing_or_wrong: string[];
  tool_connection_assessment: string;
  findings: Finding[];
  suggested_next_steps: string[];
}
