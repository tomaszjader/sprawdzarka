import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AuditReportSchema, type AuditReport } from "./reportSchema.js";

export const defaultModel = process.env.OPENAI_MODEL ?? "gpt-5.5";

function buildInput(task: string, code: string, testOutput: string) {
  return [
    {
      role: "system" as const,
      content:
        "You are a strict but fair senior AI-agent code auditor. Judge whether the submitted code implements the user's stated task. Focus on concrete evidence from code and test output. Do not assume external services work unless the code clearly configures and calls them. For tool-using agents, check whether tools such as weather APIs are actually wired, validated, called, and handled on failure."
    },
    {
      role: "user" as const,
      content: `TASK TO VERIFY:
${task}

CODE TO AUDIT:
${code || "[No readable code was collected.]"}

TEST OR RUN OUTPUT:
${testOutput}

Return a practical verdict for the developer. Be precise about missing API calls, fake/stubbed tool connections, broken configuration, weak error handling, and whether the code really satisfies the task.`
    }
  ];
}

export async function auditCode(
  task: string,
  code: string,
  testOutput: string,
  model = defaultModel
): Promise<AuditReport> {
  const client = new OpenAI();
  const response = await client.responses.parse({
    model,
    input: buildInput(task, code, testOutput),
    text: {
      format: zodTextFormat(AuditReportSchema, "audit_report")
    },
    reasoning: { effort: "medium" }
  });

  for (const output of response.output) {
    if (output.type !== "message") {
      continue;
    }

    for (const item of output.content) {
      if (item.type === "refusal") {
        throw new Error(`Model refused the audit: ${item.refusal}`);
      }

      if ("parsed" in item && item.parsed) {
        return item.parsed as AuditReport;
      }
    }
  }

  throw new Error("OpenAI response did not contain a parsed audit report.");
}
