import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { auditCode, defaultModel } from "./audit.js";
import { collectCode } from "./fileCollector.js";
import { runTestCommand } from "./testRunner.js";

const AuditRequestSchema = z.object({
  task: z.string().trim().min(1, "Wpisz zadanie do sprawdzenia."),
  codePaths: z.array(z.string().trim().min(1)).min(1, "Podaj przynajmniej jedna sciezke do kodu."),
  testCommand: z.string().trim().optional(),
  testCwd: z.string().trim().optional(),
  model: z.string().trim().optional(),
  maxChars: z.number().int().min(1000).max(1_000_000).default(120_000)
});

const app = express();
const port = Number(process.env.PORT ?? 8765);
const host = process.env.HOST ?? "127.0.0.1";

app.use(express.json({ limit: "1mb" }));

app.get("/api/config", (_request, response) => {
  response.json({ defaultModel });
});

app.post("/api/audit", async (request, response) => {
  try {
    const payload = AuditRequestSchema.parse(request.body);
    const code = await collectCode(payload.codePaths, payload.maxChars);
    const testOutput = await runTestCommand(payload.testCommand, payload.testCwd || process.cwd());
    const report = await auditCode(payload.task, code, testOutput, payload.model || defaultModel);

    response.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udalo sie wykonac audytu.";
    response.status(400).json({ error: message });
  }
});

const dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(dirname, "../dist");

app.use(express.static(distPath));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, host, () => {
  console.log(`Sprawdzarka API dziala pod adresem: http://${host}:${port}`);
});
