import { exec } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const maxCommandLength = 300;
const blockedCommandPatterns = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[fsq]/i,
  /\brmdir\s+\/s\b/i,
  /\bremove-item\b.*\s-(recurse|r)\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i
];

export async function runTestCommand(command?: string, cwd = process.cwd()): Promise<string> {
  if (!command) {
    return "No test command was provided.";
  }

  const trimmedCommand = command.trim();
  if (trimmedCommand.length > maxCommandLength) {
    return `Test command was not run: command is longer than ${maxCommandLength} characters.`;
  }

  if (blockedCommandPatterns.some((pattern) => pattern.test(trimmedCommand))) {
    return "Test command was not run: command looks destructive or unsafe.";
  }

  const resolvedCwd = path.resolve(cwd);
  try {
    const cwdDetails = await stat(resolvedCwd);
    if (!cwdDetails.isDirectory()) {
      return `Test command was not run: working directory is not a directory: ${resolvedCwd}`;
    }
  } catch {
    return `Test command was not run: working directory does not exist: ${resolvedCwd}`;
  }

  try {
    const result = await execAsync(trimmedCommand, {
      cwd: resolvedCwd,
      timeout: 120_000,
      windowsHide: true,
      maxBuffer: 20_000_000
    });

    return formatOutput(trimmedCommand, 0, result.stdout, result.stderr);
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string; message?: string };
    return formatOutput(
      trimmedCommand,
      typeof failed.code === "number" ? failed.code : 1,
      failed.stdout ?? "",
      failed.stderr ?? failed.message ?? ""
    );
  }
}

function formatOutput(command: string, code: number, stdout: string, stderr: string): string {
  const output = [
    `Command: ${command}`,
    `Exit code: ${code}`,
    "STDOUT:",
    stdout.trim(),
    "STDERR:",
    stderr.trim()
  ].join("\n");

  return output.slice(-20_000);
}
