import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

const maxCommandLength = 300;
const maxOutputBytes = 20_000_000;
const timeoutMs = 120_000;
const packageManagers = new Set(["npm", "pnpm", "yarn", "bun"]);
const directTestCommands = new Set(["pytest", "vitest", "jest", "mocha", "tsc"]);

export async function runTestCommand(command?: string, cwd = process.cwd()): Promise<string> {
  if (!command) {
    return "No test command was provided.";
  }

  const trimmedCommand = command.trim();
  if (trimmedCommand.length > maxCommandLength) {
    return `Test command was not run: command is longer than ${maxCommandLength} characters.`;
  }

  let parsedCommand: ParsedCommand;
  try {
    parsedCommand = parseAllowedTestCommand(trimmedCommand);
  } catch (error) {
    const message = error instanceof Error ? error.message : "command is not allowed.";
    return `Test command was not run: ${message}`;
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

  const result = await runAllowedCommand(parsedCommand, resolvedCwd);
  return formatOutput(trimmedCommand, result.code, result.stdout, result.stderr);
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

interface ParsedCommand {
  executable: string;
  args: string[];
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

function parseAllowedTestCommand(command: string): ParsedCommand {
  const parts = splitCommandLine(command);
  if (!parts.length) {
    throw new Error("command is empty.");
  }

  const executable = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (packageManagers.has(executable)) {
    if (isAllowedPackageManagerArgs(executable, args)) {
      return packageManagerCommandForPlatform(executable, args);
    }

    throw new Error("only package-manager test scripts are allowed, for example npm test or npm run typecheck.");
  }

  if (executable === "python" || executable === "python3" || executable === "py") {
    if (args[0] === "-m" && args[1] === "pytest") {
      return { executable, args };
    }

    throw new Error("only python -m pytest is allowed for Python commands.");
  }

  if (directTestCommands.has(executable)) {
    return { executable, args };
  }

  throw new Error("command is not on the allowlist.");
}

function isAllowedPackageManagerArgs(executable: string, args: string[]): boolean {
  if (!args.length) {
    return false;
  }

  if (args[0] === "test" && args.length === 1) {
    return true;
  }

  if (args[0] === "run" && args.length === 2 && isSafeScriptName(args[1])) {
    return true;
  }

  return executable === "yarn" && args.length === 1 && Boolean(args[0] && isSafeScriptName(args[0]));
}

function isSafeScriptName(scriptName: string): boolean {
  return /^[a-z0-9:_-]+$/i.test(scriptName);
}

function packageManagerCommandForPlatform(command: string, args: string[]): ParsedCommand {
  if (process.platform !== "win32") {
    return { executable: command, args };
  }

  if (command === "npm") {
    const npmCliPath = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    return { executable: process.execPath, args: [npmCliPath, ...args] };
  }

  return { executable: `${command}.cmd`, args };
}

function splitCommandLine(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("quoted argument is not closed.");
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function runAllowedCommand(command: ParsedCommand, cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command.executable, command.args, {
        cwd,
        shell: false,
        windowsHide: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start command.";
      resolve({ code: 1, stdout: "", stderr: message });
      return;
    }

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\nCommand timed out after ${timeoutMs / 1000} seconds.`;
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const nextBytes = outputBytes + chunk.length;
      if (nextBytes <= maxOutputBytes) {
        stdout += chunk.toString("utf8");
      }
      outputBytes = nextBytes;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const nextBytes = outputBytes + chunk.length;
      if (nextBytes <= maxOutputBytes) {
        stderr += chunk.toString("utf8");
      }
      outputBytes = nextBytes;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const exitCode = typeof code === "number" ? code : 1;
      const signalText = signal ? `\nProcess ended with signal ${signal}.` : "";
      resolve({ code: exitCode, stdout, stderr: `${stderr}${signalText}` });
    });
  });
}
