import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import semver from "semver";
import { hasMarker } from "../eject/marker";
import { findAdminConfig } from "../scaffold/config-target";
import { detectAppDir, fileExists } from "../utils/detect";
import { inspectDependency } from "../utils/project-packages";

export { countCoreInstances } from "./installed-core";

export async function checkEjectMarker(
  cwd: string,
  resourceName: string,
  adminPath = "/admin",
): Promise<string | null> {
  const appDir = await detectAppDir(cwd);
  const candidate = path.join(cwd, appDir, adminPath, resourceName, "page.tsx");
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
export async function staleEjectMarkers(
  cwd: string,
  appDir: string,
  adminPath = "/admin",
): Promise<string[] | null> {
  const entries = await fs
    .readdir(path.join(cwd, appDir, adminPath), { withFileTypes: true })
    .catch(() => []);
  const names = entries
    .filter((entry) => entry.isDirectory() && !/^[[.]/.test(entry.name))
    .map((entry) => entry.name);
  if (names.length === 0) return null;
  const warnings = await Promise.all(names.map((name) => checkEjectMarker(cwd, name, adminPath)));
  return warnings.filter((warning): warning is string => warning !== null);
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
export async function fixPrecondition(cwd: string, dlx = "pnpm dlx"): Promise<string | undefined> {
  if ((await findAdminConfig(cwd)) !== null) return undefined;
  return `no flowpanel.config.ts in ${cwd}, so FlowPanel is not set up here yet. Run \`${dlx} @flowpanel/cli init\` first.`;
}

const TYPEGEN_SINCE = "15.5.0";

/** Runs `next typegen` when `.next/types` is missing; returns why it failed, or `null`. */
export async function ensureNextTypes(cwd: string): Promise<string | null> {
  if (await fileExists(path.join(cwd, ".next/types"))) return null;
  const { installed } = await inspectDependency(cwd, "next");
  const bin = installed?.manifest.bin;
  const entry = typeof bin === "string" ? bin : bin?.next;
  if (!installed || typeof entry !== "string") return null;
  const version = semver.coerce(installed.version);
  if (version === null || semver.lt(version, TYPEGEN_SINCE)) return null;
  try {
    execFileSync(process.execPath, [path.resolve(installed.directory, entry), "typegen"], {
      cwd,
      stdio: "pipe",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      timeout: 120_000,
    });
    return null;
  } catch (e) {
    return firstDiagnostics(e) ?? (e instanceof Error ? e.message : String(e));
  }
}
