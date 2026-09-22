import * as path from "node:path";
import { readTsconfigAliases } from "../commands/migrate";
import { fileExists } from "../utils/detect";
import { log } from "../utils/log";

interface JitiInstance {
  import: (id: string) => Promise<unknown>;
}

interface JitiModule {
  createJiti: (
    cwd: string,
    opts?: { interopDefault?: boolean; jsx?: boolean; alias?: Record<string, string> },
  ) => JitiInstance;
}

/** Either the config's own warnings, or why they could not be read. */
export type ConfigWarnings = { warnings: string[] } | { unreadable: string };

function warningsOf(value: unknown): string[] {
  const warnings = (value as { warnings?: unknown } | null)?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((entry): entry is string => typeof entry === "string");
}

function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return (message.split("\n")[0] ?? "").trim() || "unknown error";
}

/** `defineAdmin`'s own warnings, read by evaluating `flowpanel.config.ts`. */
export async function readConfigWarnings(cwd: string): Promise<ConfigWarnings> {
  const configPath = path.join(cwd, "flowpanel.config.ts");
  if (!(await fileExists(configPath))) return { warnings: [] };
  try {
    const { createJiti } = (await import("jiti")) as JitiModule;
    const jiti = createJiti(cwd, {
      interopDefault: true,
      jsx: true,
      alias: await readTsconfigAliases(cwd),
    });
    const mod = (await jiti.import(configPath)) as { default?: unknown };
    return { warnings: warningsOf(mod?.default ?? mod) };
  } catch (err) {
    return { unreadable: firstLine(err) };
  }
}

/** Print the config's warnings, or say that they could not be checked. */
export function printConfigWarnings(result: ConfigWarnings): void {
  if ("unreadable" in result) {
    log.warn(
      `flowpanel.config.ts could not be evaluated: ${result.unreadable}; config warnings skipped`,
    );
    return;
  }
  for (const warning of result.warnings) log.warn(warning);
}
