import { z } from "zod";

export const FindingSchema = z.object({
  severity: z.enum(["blocker", "high", "medium", "low", "info"]),
  title: z.string(),
  evidence: z.string(),
  recommendation: z.string()
});

export const AuditReportSchema = z.object({
  verdict: z.enum(["pass", "partial", "fail", "unclear"]),
  confidence: z.number().min(0).max(1),
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  matches_task: z.array(z.string()),
  missing_or_wrong: z.array(z.string()),
  tool_connection_assessment: z.string(),
  findings: z.array(FindingSchema),
  suggested_next_steps: z.array(z.string())
});

export type AuditReport = z.infer<typeof AuditReportSchema>;
