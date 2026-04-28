/**
 * `flowpanel migrate` — apply FlowPanel's own schema migrations.
 *
 * Right now this is a single table: `flowpanel_audit_log`. The runner is
 * idempotent — re-running it is a no-op, so this can safely live in a
 * postinstall hook or CI step.
 *
 * We shell out to `tsx` (or `node --import tsx`) so the user's config can
 * freely import TypeScript, path aliases, and ESM — without the CLI
 * shipping its own bundler. This is the same strategy Prisma/Drizzle use
 * for their seed scripts.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";

const CANDIDATES = [
  "src/flowpanel.ts",
  "flowpanel.ts",
  "src/app/flowpanel.ts",
  "flowpanel.config.ts",
  "src/flowpanel.config.ts",
];

export function migrateCommand(cli: Command): void {
  cli
    .command("migrate")
    .description("Apply FlowPanel's schema migrations (creates flowpanel_audit_log)")
    .option("--config <path>", "Path to the flowpanel config file")
    .option("--dry-run", "Report pending migrations without running them")
    .action(async (opts: { config?: string; dryRun?: boolean }) => {
      p.intro(pc.bgBlue(pc.white(" FlowPanel migrate ")));

      const configPath = opts.config
        ? resolve(process.cwd(), opts.config)
        : CANDIDATES.map((c) => resolve(process.cwd(), c)).find((p) => existsSync(p));

      if (!configPath) {
        p.log.error(
          "No FlowPanel config found. Looked for: " +
            CANDIDATES.join(", ") +
            ". Pass --config <path> to point at yours.",
        );
        process.exit(1);
      }

      const s = p.spinner();
      s.start(`Loading config from ${pc.dim(configPath)}`);

      try {
        const mod = await import(pathToFileURL(configPath).href);
        const flowpanel = mod.flowpanel ?? mod.default;
        if (!flowpanel || typeof flowpanel.getDb !== "function") {
          s.stop(pc.red("✗ Config did not export a FlowPanel instance"));
          p.log.error(
            "Expected the file to `export const flowpanel = defineFlowPanel({ ... })` " +
              "or `export default defineFlowPanel({ ... })`.",
          );
          process.exit(1);
        }

        s.message("Checking migration status");
        // Dynamic import keeps @flowpanel/core a peer, not a hard dep.
        const core = await import("@flowpanel/core");
        const db = await flowpanel.getDb();

        // Resolve @flowpanel/core's bundled migrations dir relative to the
        // user's project (NOT the CLI's own node_modules — those may live
        // in a different pnpm virtual store).
        const userRequire = createRequire(pathToFileURL(configPath).href);
        let coreMigrations: string;
        try {
          const corePkgPath = userRequire.resolve("@flowpanel/core/package.json");
          coreMigrations = resolve(dirname(corePkgPath), "migrations");
        } catch {
          s.stop(pc.red("✗ Could not resolve @flowpanel/core package"));
          p.log.error("Make sure @flowpanel/core is installed in this project.");
          process.exit(1);
        }

        const status = await core.getMigrationStatus(db, [coreMigrations]);
        const pending = status.pending;

        if (pending.length === 0) {
          s.stop(pc.green(`✓ Already up to date (${status.applied.length} migration(s) applied)`));
          p.outro(pc.dim("Nothing to do."));
          return;
        }

        if (opts.dryRun) {
          s.stop(pc.yellow(`! ${pending.length} pending migration(s)`));
          for (const id of pending) {
            console.log(`  ${pc.dim("→")} ${id}`);
          }
          p.outro(pc.dim("Run without --dry-run to apply."));
          return;
        }

        s.message(`Applying ${pending.length} migration(s)`);
        const result = await core.applyMigrations(db, [coreMigrations], (id) => {
          s.message(`Applied ${id}`);
        });
        s.stop(pc.green(`✓ Applied ${result.applied.length} migration(s)`));
        p.outro(pc.green("FlowPanel schema is up to date."));
      } catch (err) {
        s.stop(pc.red("✗ Migration failed"));
        const msg = err instanceof Error ? err.message : String(err);
        p.log.error(msg);
        process.exit(1);
      }
    });
}
