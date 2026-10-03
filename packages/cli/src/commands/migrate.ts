import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { missingConnectionEnv } from "../utils/db-env";
import { detectPackageManager, fileExists, pmCommands } from "../utils/detect";
import { describeFatal } from "../utils/fail";
import { exitAfterFlush, writeJson } from "../utils/output";
import { noNextProject } from "../utils/project-root";
import { configDialect } from "../utils/sql-dialect";
import { readTsconfigAliases } from "../utils/tsconfig";
import { createUi } from "../utils/ui";

interface MigrateOptions {
  dryRun?: boolean;
  json?: boolean;
}

interface MigrationAdapter {
  applyMigration?: (id: string, sql: string) => Promise<void>;
  listAppliedMigrations?: () => Promise<Set<string>>;
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

interface MigrationExecutor {
  applyMigration: (id: string, sql: string) => Promise<void>;
  listAppliedMigrations: () => Promise<Set<string>>;
}

export function resolveMigrationExecutor(
  adapter: MigrationAdapter | undefined,
): MigrationExecutor | undefined {
  const listAppliedMigrations = adapter?.listAppliedMigrations?.bind(adapter);
  if (typeof listAppliedMigrations !== "function") return undefined;

  const applyMigration = adapter?.applyMigration?.bind(adapter);
  if (typeof applyMigration !== "function") return undefined;
  return { applyMigration, listAppliedMigrations };
}

export function migrateCommand(cli: Command): void {
  cli
    .command("migrate")
    .description("Apply SQL migrations from flowpanel/migrations/")
    .option("--dry-run", "Print migrations that would be applied without running them")
    .option("--json", "Emit machine-readable JSON")
    .action(async (opts: MigrateOptions) => {
      const ui = createUi(opts.json);
      ui.intro(pc.bgMagenta(pc.black(" FlowPanel migrate ")));

      const cwd = process.cwd();
      const pmc = pmCommands(await detectPackageManager(cwd));
      const dir = path.join(cwd, "flowpanel", "migrations");
      const cfgPath = path.join(cwd, "flowpanel.config.ts");
      const stop: (message: string) => never = (message) => {
        if (opts.json) writeJson({ command: "migrate", applied: false, error: message });
        else ui.cancel(message);
        process.exit(1);
      };

      const notProject = await noNextProject(cwd);
      if (notProject) stop(notProject);
      if (!(await fileExists(cfgPath))) {
        stop(`flowpanel.config.ts not found. Run \`${pmc.dlx} @flowpanel/cli init\` first.`);
      }

      const files = (await fs.readdir(dir).catch(() => [] as string[]))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      if (files.length === 0) {
        if (opts.json) {
          writeJson({ command: "migrate", applied: false, pending: [], reason: "no-migrations" });
        } else ui.outro(pc.yellow(`No migrations found in ${path.relative(cwd, dir)}`));
        return;
      }

      // --dry-run stops here: everything below opens a connection and creates the tracking table.
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
          ui.note(files.join("\n"), "Would apply unless already applied");
          ui.outro(pc.dim("Dry run: no database connection was made."));
        }
        return;
      }

      const missingEnv = await missingConnectionEnv(
        cwd,
        await configDialect(cwd),
        `${pmc.exec} flowpanel migrate`,
      );
      if (missingEnv) stop(missingEnv);

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
          stop(
            `flowpanel migrate needs jiti to load your TypeScript config. Install it: ${pmc.addDisplay("jiti", true)}`,
          );
        }
        throw e;
      }

      let config: MaybeConfig = {};
      try {
        const mod = (await jiti.import(cfgPath)) as { default?: MaybeConfig } | MaybeConfig;
        config = ((mod as { default?: MaybeConfig }).default ?? mod) as MaybeConfig;
      } catch (e) {
        stop(`Failed to load flowpanel.config.ts: ${e instanceof Error ? e.message : String(e)}`);
      }

      const executor = resolveMigrationExecutor(config.adapter);
      if (!executor) {
        stop(
          "The config's adapter cannot run migrations. Use drizzleAdapter or prismaAdapter from @flowpanel/kit.",
        );
      }

      const appliedNow: string[] = [];
      try {
        // This is a UX snapshot, not a concurrency claim — another CLI process can invalidate it.
        const applied = await executor.listAppliedMigrations();
        for (const f of files) {
          const id = f.replace(/\.sql$/, "");
          if (applied.has(id)) {
            ui.info(`${id} already applied`);
            continue;
          }
          const sql = await fs.readFile(path.join(dir, f), "utf8");
          await executor.applyMigration(id, sql);
          appliedNow.push(id);
          ui.ok(`${id} applied`);
        }
      } catch (err) {
        if (!opts.json) throw err;
        writeJson({
          command: "migrate",
          applied: appliedNow.length > 0,
          migrations: appliedNow,
          error: describeFatal(err).message,
        });
        process.exit(1);
      }

      const ran = appliedNow.length;
      if (opts.json) {
        writeJson({
          command: "migrate",
          applied: ran > 0,
          migrations: appliedNow,
          alreadyApplied: files.length - ran,
        });
      } else if (ran === 0) {
        ui.outro(pc.dim("All migrations up to date."));
      } else {
        ui.outro(pc.green(`${ran} migration${ran === 1 ? "" : "s"} applied`));
      }
      await exitAfterFlush(0);
    });
}
