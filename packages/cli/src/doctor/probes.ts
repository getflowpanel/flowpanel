import * as fs from "node:fs/promises";
import * as path from "node:path";
import { hasMarker } from "../eject/marker";
import { detectAppDir, fileExists } from "../utils/detect";

export async function checkEjectMarker(cwd: string, resourceName: string): Promise<string | null> {
  const appDir = await detectAppDir(cwd);
  const candidate = path.join(cwd, appDir, "admin", resourceName, "page.tsx");
  try {
    const src = await fs.readFile(candidate, "utf8");
    if (!hasMarker(src)) {
      return (
        `${path.relative(cwd, candidate)} exists but lacks the eject marker. ` +
        `If this file is hand-written, that's fine; if it was meant to be ejected, ` +
        `re-run \`flowpanel eject resource ${resourceName}\` (or add the marker manually).`
      );
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
  }
  return null;
}

/**
 * Warnings for `admin/<name>/page.tsx` files that lost their eject marker.
 * `null` means the project has no ejected resource directories at all.
 */
export async function staleEjectMarkers(cwd: string, appDir: string): Promise<string[] | null> {
  const entries = await fs
    .readdir(path.join(cwd, appDir, "admin"), { withFileTypes: true })
    .catch(() => []);
  const names = entries
    .filter((entry) => entry.isDirectory() && !/^[[.]/.test(entry.name))
    .map((entry) => entry.name);
  if (names.length === 0) return null;
  const warnings = await Promise.all(names.map((name) => checkEjectMarker(cwd, name)));
  return warnings.filter((warning): warning is string => warning !== null);
}

/**
 * Counts `@flowpanel/core` copies in pnpm's store. `null` means the layout this
 * reads does not exist, so the check is skipped rather than reported as passing.
 */
export async function countCoreInstances(cwd: string): Promise<number | null> {
  const pnpmDir = path.join(cwd, "node_modules", ".pnpm");
  let entries: string[];
  try {
    entries = await fs.readdir(pnpmDir);
  } catch {
    return null;
  }
  return entries.filter((name) => name.startsWith("@flowpanel+core@")).length;
}

/** The head of a failed `tsc` run — the compile is already paid for, so show what it found. */
export function firstDiagnostics(e: unknown, limit = 5): string | null {
  const io = e as { stdout?: Buffer | string | null; stderr?: Buffer | string | null };
  const lines = `${io.stdout?.toString() ?? ""}\n${io.stderr?.toString() ?? ""}`
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;
  const head = lines.slice(0, limit);
  if (lines.length > limit) head.push(`… ${lines.length - limit} more line(s)`);
  return head.join("\n    ");
}

/**
 * `--fix` writes route files that import `flowpanel.config`. Outside a FlowPanel
 * project that scaffolds an admin into a tree that never asked for one.
 */
export async function fixPrecondition(cwd: string): Promise<string | undefined> {
  for (const name of ["flowpanel.config.ts", "flowpanel.config.tsx"]) {
    if (await fileExists(path.join(cwd, name))) return undefined;
  }
  return `no flowpanel.config.ts in ${cwd} — this is not a FlowPanel project. Run \`flowpanel init\` first.`;
}
