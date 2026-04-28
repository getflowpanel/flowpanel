/**
 * Import-boundary check: verify that the FlowPanel server config can't be
 * pulled into the client bundle by accident.
 *
 * We rely on a simple convention instead of a full AST walker:
 *   1. The config file must have `import "server-only"` at the top (Next.js'
 *      standard guard that throws at module-evaluation time if anyone pulls
 *      it into a client component).
 *   2. No file with `"use client"` directive — nor `.client.ts` / `.client.tsx`
 *      — may transitively import the config file.
 *
 * Regex-based import extraction is good enough for the 99% case and avoids
 * pulling a TypeScript compiler into the CLI. Document the caveat.
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export interface BoundaryCheckInput {
  cwd: string;
  /** Candidate paths (relative to cwd) to search for the FlowPanel config. */
  configCandidates?: readonly string[];
  /** Directories to scan for client files (relative to cwd). */
  scanDirs?: readonly string[];
}

export interface BoundaryLeak {
  /** Client file that reaches the config. */
  from: string;
  /** Import chain: from → …intermediate files… → config. */
  chain: readonly string[];
}

export interface BoundaryCheckResult {
  configPath: string | null;
  hasServerOnly: boolean;
  leaks: readonly BoundaryLeak[];
}

const DEFAULT_CANDIDATES = [
  "src/flowpanel.ts",
  "flowpanel.ts",
  "src/app/flowpanel.ts",
  "flowpanel.config.ts",
  "src/flowpanel.config.ts",
] as const;

const DEFAULT_SCAN_DIRS = ["src", "app", "components"] as const;

const SERVER_ONLY_RE = /^\s*import\s+["']server-only["']/m;
const USE_CLIENT_RE = /^["']use client["']/m;
const IMPORT_RE = /from\s+["']([^"']+)["']/g;

export async function checkBoundary(input: BoundaryCheckInput): Promise<BoundaryCheckResult> {
  const { cwd, configCandidates = DEFAULT_CANDIDATES, scanDirs = DEFAULT_SCAN_DIRS } = input;

  const configPath = findConfig(cwd, configCandidates);
  if (!configPath) {
    return { configPath: null, hasServerOnly: false, leaks: [] };
  }

  const configSource = readFileSync(configPath, "utf8");
  const hasServerOnly = SERVER_ONLY_RE.test(configSource);

  const clientFiles: string[] = [];
  for (const dir of scanDirs) {
    const abs = resolve(cwd, dir);
    if (!existsSync(abs)) continue;
    await collectClientFiles(abs, clientFiles);
  }

  const leaks: BoundaryLeak[] = [];
  for (const file of clientFiles) {
    const chain = findChain(file, configPath, new Set());
    if (chain) {
      leaks.push({
        from: relative(cwd, file),
        chain: chain.map((f) => relative(cwd, f)),
      });
    }
  }

  return { configPath: relative(cwd, configPath), hasServerOnly, leaks };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function findConfig(cwd: string, candidates: readonly string[]): string | null {
  for (const c of candidates) {
    const abs = resolve(cwd, c);
    if (existsSync(abs)) return abs;
  }
  return null;
}

async function collectClientFiles(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      await collectClientFiles(abs, out);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) continue;
    const src = readFileSync(abs, "utf8");
    if (/\.client\.(ts|tsx)$/.test(e.name) || USE_CLIENT_RE.test(src)) {
      out.push(abs);
    }
  }
}

/**
 * DFS from `file` along its imports. Returns the chain including `file` and
 * `target` if reachable, or null if not.
 */
function findChain(file: string, target: string, visited: Set<string>): string[] | null {
  if (file === target) return [file];
  if (visited.has(file)) return null;
  visited.add(file);

  const source = readResolved(file);
  if (!source) return null;

  const dir = dirname(file);
  for (const spec of extractImports(source)) {
    if (!spec.startsWith(".") && !isAbsolute(spec)) continue;
    const resolved = resolveImport(dir, spec);
    if (!resolved) continue;
    const chain = findChain(resolved, target, visited);
    if (chain) return [file, ...chain];
  }
  return null;
}

function readResolved(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function extractImports(source: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
  while ((m = IMPORT_RE.exec(source)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function resolveImport(fromDir: string, spec: string): string | null {
  const base = resolve(fromDir, spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    join(base, "index.js"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
