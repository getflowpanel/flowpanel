import { execFileSync } from "node:child_process";
import * as path from "node:path";
import type { PmCommands } from "../utils/detect";
import { inspectDependency } from "../utils/project-packages";
import { ensureNextTypes, firstDiagnostics } from "./probes";

/** Runs the project's own `tsc --noEmit`, after generating Next's route types when they are missing. */
export async function runTsc(
  cwd: string,
  pmc: PmCommands,
): Promise<{ ok: boolean; hint?: string }> {
  const tsc = await inspectDependency(cwd, "typescript");
  const bin = tsc.installed?.manifest.bin;
  const entry = typeof bin === "string" ? bin : typeof bin?.tsc === "string" ? bin.tsc : null;
  if (!tsc.installed || !entry) {
    return { ok: false, hint: "TypeScript is not installed with a tsc binary in this project." };
  }
  try {
    await ensureNextTypes(cwd);
    execFileSync(process.execPath, [path.resolve(tsc.installed.directory, entry), "--noEmit"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true };
  } catch (e: unknown) {
    const diagnostics = firstDiagnostics(e);
    return {
      ok: false,
      hint: diagnostics
        ? `${diagnostics}\n    Full list: ${[pmc.exec, ...pmc.execArgs("tsc", ["--noEmit"])].join(" ")}`
        : "TypeScript errors in project.",
    };
  }
}
