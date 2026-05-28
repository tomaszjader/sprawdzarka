import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const textExtensions = new Set([
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
  ".yml"
]);

const skipDirs = new Set([
  ".git",
  ".idea",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "dist",
  "dist-server",
  "node_modules",
  "venv"
]);

async function walk(targetPath: string): Promise<string[]> {
  const absolutePath = path.resolve(targetPath);
  const details = await stat(absolutePath);

  if (details.isFile()) {
    const ext = path.extname(absolutePath).toLowerCase();
    return textExtensions.has(ext) || ext === "" ? [absolutePath] : [];
  }

  if (!details.isDirectory()) {
    return [];
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await walk(entryPath)));
      continue;
    }

    if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      collected.push(entryPath);
    }
  }

  return collected;
}

export async function collectCode(paths: string[], maxChars: number): Promise<string> {
  const files = [...new Set((await Promise.all(paths.map(walk))).flat())].sort();
  const chunks: string[] = [];
  let used = 0;

  for (const filePath of files) {
    let text: string;
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const header = `\n\n--- FILE: ${filePath} ---\n`;
    const remaining = maxChars - used - header.length;
    if (remaining <= 0) {
      break;
    }

    if (text.length > remaining) {
      text = `${text.slice(0, remaining)}\n[TRUNCATED]\n`;
    }

    chunks.push(header + text);
    used += header.length + text.length;
  }

  return chunks.join("").trim();
}
