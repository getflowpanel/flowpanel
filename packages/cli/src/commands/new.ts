import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { editConfigToAddResource } from "../eject/addResource";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FilesystemPlan } from "../plan/types";
import { findAdminConfig } from "../scaffold/config-target";
import { planNewIntoDir } from "../scaffold/plan-new";
import { resolveProjectModule } from "../utils/module-path";
import { writeJson, writePlanJson } from "../utils/output";
import { readTsconfigOptions } from "../utils/tsconfig";

/** Names a module exports, as far as a source scan can tell. */
function exportedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|var|function|class)\s+(\w+)/g,
  )) {
    names.add(m[1] as string);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of (m[1] as string).split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Export name → SQL table name, for every `export const x = pgTable("x_sql", ...)` the scan finds. */
function tableNamesOf(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of source.matchAll(
    /export\s+const\s+(\w+)\s*=\s*\w*[Tt]able\(\s*["'`]([\w.-]+)["'`]/g,
  )) {
    found.set(m[1] as string, m[2] as string);
  }
  return found;
}

type SchemaCheck =
  | { status: "ok"; exportName: string }
  | { status: "missing"; message: string }
  | { status: "unverified"; reason: string };

/** `@/db/schema` under `src/` or the project root, for a host with no tsconfig `paths` at all. */
async function bareAliasFallback(cwd: string, spec: string): Promise<string | null> {
  if (!spec.startsWith("@/")) return null;
  if ((await readTsconfigOptions(cwd))?.paths) return null;
  const bare = spec.slice(2);
  for (const base of [path.join(cwd, "src", bare), path.join(cwd, bare)]) {
    const found = await resolveProjectModule(cwd, base);
    if (found) return found;
  }
  return null;
}

/**
 * Checks the resource maps to a real table before writing it into the config —
 * otherwise `flowpanel new` happily produces a line that cannot compile.
 */
export async function checkSchemaExport(
  cwd: string,
  configFile: string,
  configSource: string,
  name: string,
): Promise<SchemaCheck> {
  const importMatch = /import\s+\*\s+as\s+schema\s+from\s+["']([^"']+)["']/.exec(configSource);
  if (!importMatch) {
    return { status: "unverified", reason: "the config has no `import * as schema` line" };
  }
  const spec = importMatch[1] as string;
  const file =
    (await resolveProjectModule(cwd, spec, configFile)) ?? (await bareAliasFallback(cwd, spec));
  if (!file) {
    return { status: "unverified", reason: `"${spec}" does not resolve to a file under ${cwd}` };
  }
  const source = await fs.readFile(file, "utf8");
  const names = exportedNames(source);
  if (names.size === 0) {
    return {
      status: "unverified",
      reason: `no exports could be read from ${path.relative(cwd, file)}`,
    };
  }
  if (names.has(name)) return { status: "ok", exportName: name };
  const tableNames = tableNamesOf(source);
  const byTableName = [...tableNames.entries()].find(([, tableName]) => tableName === name)?.[0];
  if (byTableName) return { status: "ok", exportName: byTableName };
  const available = [...names].sort().slice(0, 12).join(", ");
  return {
    status: "missing",
    message:
      `${path.relative(cwd, file)} has no export or table named "${name}".\n` +
      (available ? `Exports there: ${available}\n` : "") +
      `Pass the table expression yourself with --table if it lives elsewhere.`,
  };
}

export type AdapterKind = "drizzle" | "prisma";
export const ADAPTER_KINDS: ReadonlyArray<AdapterKind> = ["drizzle", "prisma"];

/** The default when `--kind` is absent; `null` for a value the flag does not accept. */
export function parseAdapterKind(raw: string | undefined): AdapterKind | null {
  if (raw === undefined) return "drizzle";
  return ADAPTER_KINDS.includes(raw as AdapterKind) ? (raw as AdapterKind) : null;
}

interface NewOptions {
  table?: string;
  kind?: string;
  dir?: string;
  hidden?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

function stop(opts: NewOptions, message: string): never {
  if (opts.json) writeJson({ command: "new", applied: false, error: message });
  else p.cancel(message);
  process.exit(1);
}

async function finish(
  plan: FilesystemPlan,
  opts: NewOptions,
  done: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (opts.dryRun) {
    if (opts.json) writePlanJson("new", plan, false, extra);
    else {
      p.note(
        publicPlan(plan)
          .operations.map((operation) => `${operation.kind.padEnd(6)} ${operation.path}`)
          .join("\n"),
        "Filesystem plan (no changes applied)",
      );
      p.outro(pc.dim("Dry run complete."));
    }
    return;
  }
  await applyFilesystemPlan(plan);
  if (opts.json) writeJson({ command: "new", applied: true, plan: publicPlan(plan), ...extra });
  else p.outro(pc.green(done));
}

/** `"<column> → <table>"` as `planNewIntoDir` reports it, parsed for the `--json` payload. */
export function unlinkedColumns(
  unlinked: readonly string[],
): Array<{ table: string; column: string }> {
  return unlinked.map((entry) => {
    const [column, table] = entry.split(" → ");
    return { table: table ?? "", column: column ?? "" };
  });
}

async function newIntoDir(cwd: string, resource: string, dir: string, opts: NewOptions) {
  if (opts.table !== undefined || parseAdapterKind(opts.kind) !== "drizzle") {
    stop(opts, "--dir reads your Drizzle schema, so it takes neither --table nor --kind prisma.");
  }
  const { intents, unlinked } = await planNewIntoDir(cwd, resource, {
    dir,
    hidden: opts.hidden === true,
  });
  const plan = await createFilesystemPlan(cwd, intents);
  const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
  if (conflicts.length > 0) {
    stop(
      opts,
      `Nothing was written: ${conflicts.map((c) => c.path).join(", ")} already exists with other content.`,
    );
  }
  if (unlinked.length > 0 && !opts.json) {
    p.log.info(
      `Written without a reference, because the target is not in ${dir} yet: ${unlinked.join(", ")}. ` +
        "Add the target with flowpanel new, then set reference on those columns.",
    );
  }
  const extra = unlinked.length > 0 ? { unlinked: unlinkedColumns(unlinked) } : {};
  await finish(plan, opts, `Added resource "${resource}" to ${dir}`, extra);
}

export function newCommand(cli: Command): void {
  cli
    .command("new <resource>")
    .description("Add a resource(...) entry to the admin config")
    .option("--table <expr>", "First argument expression (default: schema.<resource>)")
    .option("--kind <kind>", "Adapter kind: drizzle (default) or prisma", "drizzle")
    .option("--dir <dir>", "Write the resource to <dir>/<name>.ts and add it to <dir>/index.ts")
    .option("--hidden", "Register the resource without a navigation entry")
    .option("--dry-run", "Print the filesystem plan without writing")
    .option("--json", "Emit machine-readable JSON")
    .action(async (resource: string, opts: NewOptions) => {
      if (!opts.json) p.intro(pc.bgGreen(pc.black(" FlowPanel new ")));
      const cwd = process.cwd();
      try {
        if (opts.dir !== undefined) {
          await newIntoDir(cwd, resource, opts.dir, opts);
          return;
        }
        const kind = parseAdapterKind(opts.kind);
        if (kind === null) {
          stop(opts, `Unknown --kind "${opts.kind}". Use one of: ${ADAPTER_KINDS.join(", ")}`);
        }
        const found = await findAdminConfig(cwd);
        if (!found) stop(opts, "flowpanel.config.ts not found — run `flowpanel init` first.");
        const source = await fs.readFile(found.file, "utf8");
        let resourceName = resource;
        if (kind === "drizzle" && opts.table === undefined) {
          const check = await checkSchemaExport(cwd, found.file, source, resource);
          if (check.status === "missing") stop(opts, check.message);
          if (check.status === "ok") resourceName = check.exportName;
          if (check.status === "unverified" && !opts.json) {
            p.log.warn(
              `Could not verify that "${resource}" is a real table — ${check.reason}.\n` +
                "Writing the entry anyway; check that it compiles.",
            );
          }
        }
        const relative = path.relative(cwd, found.file);
        const updated = editConfigToAddResource(source, resourceName, {
          ...(opts.table !== undefined ? { table: opts.table } : {}),
          kind,
          filename: relative,
        });
        const plan = await createFilesystemPlan(cwd, [
          { path: relative, content: updated, expectedContent: source },
        ]);
        await finish(plan, opts, `Added resource "${resourceName}" to ${relative}`);
      } catch (e: unknown) {
        stop(opts, `Failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
}
