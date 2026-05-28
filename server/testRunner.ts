import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runTestCommand(command?: string, cwd = process.cwd()): Promise<string> {
  if (!command) {
    return "No test command was provided.";
  }

  try {
    const result = await execAsync(command, {
      cwd,
      timeout: 120_000,
      windowsHide: true,
      maxBuffer: 20_000_000
    });

    return formatOutput(command, 0, result.stdout, result.stderr);
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string; message?: string };
    return formatOutput(
      command,
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
