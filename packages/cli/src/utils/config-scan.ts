import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileExists } from "./detect.js";

const CONFIG_FILE_CANDIDATES = [
  "flowpanel.config.ts",
  "flowpanel.config.tsx",
  "src/admin/flowpanel.config.ts",
  "src/flowpanel.config.ts",
];

/** Roots of the decomposed config layout (`resources/*.ts`, `dashboards/*.ts`, …). */
const CONFIG_DIR_CANDIDATES = ["admin", "src/admin", "config/admin", "src/config/admin"];

const SCAN_FILE_LIMIT = 200;

async function collectSources(dir: string, out: string[]): Promise<void> {
  if (out.length >= SCAN_FILE_LIMIT) return;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (out.length >= SCAN_FILE_LIMIT) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await collectSources(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
}

/**
 * Files a static config check can read, relative to `cwd`: the single-file
 * layouts plus every source under the decomposed-config roots.
 */
export async function configSourceFiles(cwd: string): Promise<string[]> {
  const abs: string[] = [];
  for (const rel of CONFIG_FILE_CANDIDATES) {
    const full = path.join(cwd, rel);
    if (await fileExists(full)) abs.push(full);
  }
  for (const rel of CONFIG_DIR_CANDIDATES) {
    await collectSources(path.join(cwd, rel), abs);
  }
  return [...new Set(abs)].map((full) => path.relative(cwd, full).split(path.sep).join("/"));
}

/** Best-effort static scan of admin config sources for destructive actions that lack a `confirm`. */
export async function findDestructiveWithoutConfirm(cwd: string): Promise<string[]> {
  const misses: string[] = [];
  for (const rel of await configSourceFiles(cwd)) {
    let src: string;
    try {
      src = await fs.readFile(path.join(cwd, rel), "utf8");
    } catch {
      continue;
    }
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line?.includes(`variant: "destructive"`)) continue;
      const slice = lines.slice(i, Math.min(i + 10, lines.length)).join("\n");
      if (!slice.includes("confirm:")) {
        misses.push(`${rel}:${i + 1}`);
      }
    }
  }
  return misses;
}
