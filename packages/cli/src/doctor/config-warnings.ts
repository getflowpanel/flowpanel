import * as path from "node:path";
import { fileExists } from "../utils/detect";
import { log } from "../utils/log";
import { readTsconfigAliases } from "../utils/tsconfig";

interface JitiInstance {
  import: (id: string) => Promise<unknown>;
}

interface JitiModule {
  createJiti: (
    cwd: string,
    opts?: { interopDefault?: boolean; jsx?: boolean; alias?: Record<string, string> },
  ) => JitiInstance;
}

/** The config's own warnings and resource count, or why the config could not be read. */
export type ConfigWarnings =
  | { warnings: string[]; resourceCount?: number }
  | { unreadable: string };

function warningsOf(value: unknown): string[] {
  const warnings = (value as { warnings?: unknown } | null)?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((entry): entry is string => typeof entry === "string");
}

function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return (message.split("\n")[0] ?? "").trim() || "unknown error";
}

function resourceCountOf(value: unknown): number | undefined {
  const resources = (value as { resources?: unknown } | null)?.resources;
  return Array.isArray(resources) ? resources.length : undefined;
}

/** `defineAdmin`'s own warnings and resource count, read by evaluating `flowpanel.config.ts`. */
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
    const config = mod?.default ?? mod;
    const resourceCount = resourceCountOf(config);
    return {
      warnings: warningsOf(config),
      ...(resourceCount !== undefined ? { resourceCount } : {}),
    };
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
