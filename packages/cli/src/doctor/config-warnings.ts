import { findAdminConfig } from "../scaffold/config-target";
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

/** What the audit table lacks: the whole table, or the columns 0.4 added. */
export type AuditTableProblem = "table" | "columns";

/** The config's own warnings and resource count, or why the config could not be read. */
export type ConfigWarnings =
  | {
      warnings: string[];
      resourceCount?: number;
      auditTable?: AuditTableProblem;
      /** Resources whose table the database does not have. */
      missingTables?: string[];
    }
  | { unreadable: string };

interface AuditProbe {
  list: (query: {
    limit: number;
    offset: number;
    scope: { key: string | null };
  }) => Promise<unknown>;
}

function auditLogOf(value: unknown): AuditProbe | null {
  const log = (value as { auditLog?: unknown } | null)?.auditLog;
  if (!log || typeof log !== "object" || !("list" in log) || typeof log.list !== "function") {
    return null;
  }
  const list = log.list;
  return { list: (query) => Promise.resolve(list.call(log, query)) };
}

const PROBE_MS = 5_000;

/** The error `run` throws within the probe time, `null` when it answers or cannot answer in time. */
async function probeError(run: () => Promise<unknown>): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), PROBE_MS);
  });
  try {
    await Promise.race([run(), timeout]);
    return null;
  } catch (err) {
    return String(err instanceof Error ? `${err.message} ${String(err.cause ?? "")}` : err);
  } finally {
    clearTimeout(timer);
  }
}

/** Reads one audit row through the admin's own store; a database that cannot answer in time is not judged. */
async function auditTableProblem(config: unknown): Promise<AuditTableProblem | undefined> {
  const log = auditLogOf(config);
  if (!log || !process.env.DATABASE_URL) return undefined;
  const text = await probeError(() => log.list({ limit: 1, offset: 0, scope: { key: null } }));
  if (text === null) return undefined;
  if (/actor_name|scope_key/.test(text)) return "columns";
  if (/flowpanel_audit_log/.test(text) && /exist|no such table/i.test(text)) return "table";
  return undefined;
}

const NO_TABLE = /relation "[^"]+" does not exist|no such table|Table '[^']+' doesn't exist/i;

/** The resources whose table the database says it does not have, counted through the admin's adapter. */
async function missingTables(config: unknown): Promise<string[]> {
  const adapter = (config as { adapter?: { count?: unknown } } | null)?.adapter;
  const byName = (config as { resourcesByName?: unknown } | null)?.resourcesByName;
  const count = adapter?.count;
  if (!process.env.DATABASE_URL || typeof count !== "function" || !(byName instanceof Map)) {
    return [];
  }
  const names = await Promise.all(
    [...byName].map(async ([name, resource]) => {
      const ref = (resource as { ref?: unknown } | null)?.ref;
      const text = await probeError(async () => count.call(adapter, ref, {}));
      return text !== null && NO_TABLE.test(text) ? String(name) : null;
    }),
  );
  return names.filter((name): name is string => name !== null);
}

function warningsOf(value: unknown): string[] {
  const warnings = (value as { warnings?: unknown } | null)?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((entry): entry is string => typeof entry === "string");
}

export function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return (message.split("\n")[0] ?? "").trim() || "unknown error";
}

function resourceCountOf(value: unknown): number | undefined {
  const resources = (value as { resources?: unknown } | null)?.resources;
  return Array.isArray(resources) ? resources.length : undefined;
}

/** `defineAdmin`'s own warnings and resource count, read by evaluating the project's config. */
export async function readConfigWarnings(cwd: string): Promise<ConfigWarnings> {
  const configPath = (await findAdminConfig(cwd))?.root;
  if (configPath === undefined) return { warnings: [] };
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
    const [auditTable, missing] = await Promise.all([
      auditTableProblem(config),
      missingTables(config),
    ]);
    return {
      warnings: warningsOf(config),
      ...(resourceCount !== undefined ? { resourceCount } : {}),
      ...(auditTable ? { auditTable } : {}),
      ...(missing.length > 0 ? { missingTables: missing } : {}),
    };
  } catch (err) {
    return { unreadable: firstLine(err) };
  }
}

/** Print the config's own warnings; an unreadable config is a failed check instead. */
export function printConfigWarnings(result: ConfigWarnings): void {
  if ("unreadable" in result) return;
  for (const warning of result.warnings) log.warn(warning);
}
