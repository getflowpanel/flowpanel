import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { fileExists } from "../utils/detect.js";
import { log } from "../utils/log.js";

interface MigrateOptions {
  dryRun?: boolean;
}

interface ExecutableDb {
  execute: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows?: Array<{ id: string }> } | Array<{ id: string }>>;
}

interface MaybeConfig {
  adapter?: { db?: ExecutableDb };
}

export function migrateCommand(cli: Command): void {
  cli
    .command("migrate")
    .description("Apply SQL migrations from flowpanel/migrations/")
    .option("--dry-run", "Print migrations that would be applied without running them")
    .action(async (opts: MigrateOptions) => {
      const cwd = process.cwd();
      const dir = path.join(cwd, "flowpanel", "migrations");

      const files = (await fs.readdir(dir).catch(() => [] as string[]))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      if (files.length === 0) {
        log.warn(`No migrations found in ${path.relative(cwd, dir)}`);
        return;
      }

      if (opts.dryRun) {
        for (const f of files) log.info(`would apply: ${f}`);
        return;
      }

      const cfgPath = path.join(cwd, "flowpanel.config.ts");
      if (!(await fileExists(cfgPath))) {
        log.err("flowpanel.config.ts not found. Run `pnpm dlx flowpanel init` first.");
        process.exit(1);
      }

      // Dynamic import of the user's TS config via jiti.
      let config: MaybeConfig;
      try {
        const jitiMod = (await import("jiti")) as {
          createJiti: (
            cwd: string,
            opts?: { interopDefault?: boolean },
          ) => {
            import: (p: string) => Promise<unknown>;
          };
        };
        const jiti = jitiMod.createJiti(cwd, { interopDefault: true });
        const mod = (await jiti.import(cfgPath)) as { default?: MaybeConfig } | MaybeConfig;
        config = ((mod as { default?: MaybeConfig }).default ?? mod) as MaybeConfig;
      } catch {
        log.err(
          "Unable to load flowpanel.config.ts. Install `jiti` in the project or run via `tsx`:",
        );
        log.dim("  pnpm add -D jiti");
        process.exit(1);
      }

      const db = config.adapter?.db;
      if (!db || typeof db.execute !== "function") {
        log.err("Adapter db.execute() unavailable. Verify drizzleAdapter({ db, schema }) wiring.");
        process.exit(1);
      }

      await db.execute(
        `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
          id text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`,
      );

      const appliedRows = await db.execute(`SELECT id FROM _flowpanel_migrations`);
      const applied = new Set<string>();
      const rows =
        (appliedRows as { rows?: Array<{ id: string }> }).rows ??
        (appliedRows as Array<{ id: string }>);
      for (const r of rows) applied.add(r.id);

      let ran = 0;
      for (const f of files) {
        const id = f.replace(/\.sql$/, "");
        if (applied.has(id)) {
          log.info(`${id} — already applied`);
          continue;
        }
        const sql = await fs.readFile(path.join(dir, f), "utf8");
        await db.execute(sql);
        await db.execute(`INSERT INTO _flowpanel_migrations (id) VALUES ($1)`, [id]);
        log.ok(`${id} applied`);
        ran++;
      }

      if (ran === 0) log.info("All migrations up to date.");
      else
        process.stdout.write(pc.green(`Done. ${ran} migration${ran === 1 ? "" : "s"} applied.\n`));
    });
}
