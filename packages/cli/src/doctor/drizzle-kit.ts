import * as fs from "node:fs/promises";
import * as path from "node:path";

export const FLOWPANEL_TABLES = ["_flowpanel_migrations", "flowpanel_audit_log"] as const;
const CONFIGS = ["ts", "mts", "cts", "js", "mjs", "cjs"].map((ext) => `drizzle.config.${ext}`);
const TABLES_FILTER = /\btablesFilter\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*')/;

function glob(pattern: string): RegExp {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${body}$`);
}

/** Whether drizzle-kit's `tablesFilter` lets `push` see a table, the way drizzle-kit reads the globs. */
function managed(filters: string[], table: string): boolean {
  if (filters.length === 0) return true;
  const flags: boolean[] = [];
  for (const filter of filters) {
    const negated = filter.startsWith("!");
    const hit = glob(negated ? filter.slice(1) : filter).test(table);
    if (negated) flags.push(!hit);
    else if (hit) flags.push(true);
  }
  return flags.length > 0 && flags.every(Boolean);
}

/** The drizzle config and the FlowPanel tables its `push` would offer to drop; `null` without a config or with a filter it cannot read. */
export async function drizzleKitDropsFlowpanelTables(
  cwd: string,
): Promise<{ file: string; tables: string[] } | null> {
  for (const file of CONFIGS) {
    const source = await fs.readFile(path.join(cwd, file), "utf8").catch(() => null);
    if (source === null) continue;
    const value = TABLES_FILTER.exec(source)?.[1];
    if (value === undefined && /\btablesFilter\b/.test(source)) return null;
    const filters = [...(value ?? "").matchAll(/["']([^"']*)["']/g)].map((match) => match[1] ?? "");
    const tables = FLOWPANEL_TABLES.filter((table) => managed(filters, table));
    return { file, tables };
  }
  return null;
}
