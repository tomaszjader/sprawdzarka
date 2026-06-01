import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const maxFiles = 500;
const maxFileBytes = 1_000_000;

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

const skipFileNames = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".npmrc",
  ".pypirc",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]);

const skipExtensions = new Set([
  ".cer",
  ".crt",
  ".der",
  ".key",
  ".p12",
  ".pem",
  ".pfx"
]);

function shouldSkipFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return skipFileNames.has(lowerName) || skipExtensions.has(path.extname(lowerName));
}

async function walk(targetPath: string): Promise<string[]> {
  const absolutePath = path.resolve(targetPath);
  let details;

  try {
    details = await stat(absolutePath);
  } catch {
    return [];
  }

  if (details.isFile()) {
    if (shouldSkipFile(path.basename(absolutePath))) {
      return [];
    }

    const ext = path.extname(absolutePath).toLowerCase();
    return (textExtensions.has(ext) || ext === "") && details.size <= maxFileBytes ? [absolutePath] : [];
  }

  if (!details.isDirectory()) {
    return [];
  }

  let entries;

  try {
    entries = await readdir(absolutePath, { withFileTypes: true });
  } catch {
    return [];
  }

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

    if (!entry.isFile() || shouldSkipFile(entry.name) || !textExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    try {
      const details = await stat(entryPath);
      if (details.size <= maxFileBytes) {
        collected.push(entryPath);
      }
    } catch {
      continue;
    }

    if (collected.length >= maxFiles) {
      break;
    }
  }

  return collected;
}

function displayPath(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);

  if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return relativePath;
  }

  return path.basename(filePath);
}

export async function collectCode(paths: string[], maxChars: number): Promise<string> {
  const files = [...new Set((await Promise.all(paths.map(walk))).flat())].sort().slice(0, maxFiles);
  const chunks: string[] = [];
  let used = 0;

  for (const filePath of files) {
    let text: string;
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const header = `\n\n--- FILE: ${displayPath(filePath)} ---\n`;
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
