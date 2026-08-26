import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { detectPackageManager, fileExists, pmCommands } from "../utils/detect";
import { log } from "../utils/log";
import { writeJson } from "../utils/output";
import { readTsconfigOptions } from "../utils/tsconfig";

interface MigrateOptions {
  dryRun?: boolean;
  json?: boolean;
}

interface MigrationAdapter {
  runMigrationSql?: (sql: string) => Promise<void>;
  listAppliedMigrations?: () => Promise<Set<string>>;
  markMigrationApplied?: (id: string) => Promise<void>;
  kind?: string;
}

interface MaybeConfig {
  adapter?: MigrationAdapter;
}

interface JitiOptions {
  interopDefault?: boolean;
  jsx?: boolean;
  alias?: Record<string, string>;
}

interface JitiInstance {
  import: (id: string) => Promise<unknown>;
}

interface JitiModule {
  createJiti: (cwd: string, opts?: JitiOptions) => JitiInstance;
}

async function readTsconfigAliases(cwd: string): Promise<Record<string, string>> {
  try {
    const compilerOptions = await readTsconfigOptions(cwd);
    const paths = compilerOptions?.paths ?? {};
    const baseUrl = compilerOptions?.baseUrl ?? ".";
    const baseDir = path.resolve(cwd, baseUrl);
    const out: Record<string, string> = {};
    for (const [key, values] of Object.entries(paths)) {
      const target = values?.[0];
      if (!target) continue;
      const cleanKey = key.replace(/\/\*$/, "");
      const cleanTarget = target.replace(/\/\*$/, "");
      out[cleanKey] = path.resolve(baseDir, cleanTarget);
    }
    return out;
  } catch {
    return {};
  }
}

export function migrateCommand(cli: Command): void {
  cli
    .command("migrate")
    .description("Apply SQL migrations from flowpanel/migrations/")
    .option("--dry-run", "Print migrations that would be applied without running them")
    .option("--json", "Emit machine-readable JSON")
    .action(async (opts: MigrateOptions) => {
      if (!opts.json) p.intro(pc.bgMagenta(pc.black(" FlowPanel migrate ")));

      const cwd = process.cwd();
      const pmc = pmCommands(await detectPackageManager(cwd));
      const dir = path.join(cwd, "flowpanel", "migrations");

      const files = (await fs.readdir(dir).catch(() => [] as string[]))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      if (files.length === 0) {
        if (opts.json) {
          writeJson({ command: "migrate", applied: false, pending: [], reason: "no-migrations" });
        } else p.outro(pc.yellow(`No migrations found in ${path.relative(cwd, dir)}`));
        return;
      }

      const cfgPath = path.join(cwd, "flowpanel.config.ts");
      if (!(await fileExists(cfgPath))) {
        log.err(`flowpanel.config.ts not found. Run \`${pmc.dlx} @flowpanel/cli init\` first.`);
        process.exit(1);
      }

      // Everything below opens a database connection, so --dry-run stops here:
      // the adapter's applied-migrations reader creates its tracking table.
      if (opts.dryRun) {
        if (opts.json) {
          writeJson({
            command: "migrate",
            applied: false,
            dryRun: true,
            appliedStateKnown: false,
            pending: files.map((file) => file.replace(/\.sql$/, "")),
          });
        } else {
          for (const file of files) log.info(`would apply: ${file}`);
          log.warn("Applied state unknown — --dry-run does not connect to the database.");
          p.outro(pc.dim(`${files.length} migration file${files.length === 1 ? "" : "s"} on disk`));
        }
        return;
      }

      let jiti: JitiInstance;
      try {
        const jitiMod = (await import("jiti")) as JitiModule;
        const alias = await readTsconfigAliases(cwd);
        jiti = jitiMod.createJiti(cwd, {
          interopDefault: true,
          jsx: true,
          alias,
        });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
          log.err("flowpanel migrate needs `jiti` to load your TypeScript config. Install:");
          log.dim(`  ${pmc.addDisplay("jiti", true)}`);
          process.exit(1);
        }
        throw e;
      }

      let config: MaybeConfig;
      try {
        const mod = (await jiti.import(cfgPath)) as { default?: MaybeConfig } | MaybeConfig;
        config = ((mod as { default?: MaybeConfig }).default ?? mod) as MaybeConfig;
      } catch (e) {
        log.err("Failed to load flowpanel.config.ts:");
        log.err((e as Error).message);
        process.exit(1);
      }

      const adapter = config.adapter;
      const runMigrationSql = adapter?.runMigrationSql?.bind(adapter);
      const listAppliedMigrations = adapter?.listAppliedMigrations?.bind(adapter);
      const markMigrationApplied = adapter?.markMigrationApplied?.bind(adapter);
      if (
        typeof runMigrationSql !== "function" ||
        typeof listAppliedMigrations !== "function" ||
        typeof markMigrationApplied !== "function"
      ) {
        log.err(
          "Adapter does not support `flowpanel migrate`. Use `drizzleAdapter` or `prismaAdapter` from a FlowPanel ≥ this version.",
        );
        process.exit(1);
      }

      const applied = await listAppliedMigrations();

      let ran = 0;
      const appliedNow: string[] = [];
      for (const f of files) {
        const id = f.replace(/\.sql$/, "");
        if (applied.has(id)) {
          if (!opts.json) log.info(`${id} — already applied`);
          continue;
        }
        const sql = await fs.readFile(path.join(dir, f), "utf8");
        await runMigrationSql(sql);
        await markMigrationApplied(id);
        appliedNow.push(id);
        if (!opts.json) log.ok(`${id} applied`);
        ran++;
      }

      if (opts.json) {
        writeJson({
          command: "migrate",
          applied: true,
          migrations: appliedNow,
          alreadyApplied: files.length - appliedNow.length,
        });
      } else if (ran === 0) {
        p.outro(pc.dim("All migrations up to date."));
      } else {
        p.outro(pc.green(`${ran} migration${ran === 1 ? "" : "s"} applied`));
      }
    });
}
