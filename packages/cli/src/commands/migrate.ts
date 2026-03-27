import * as path from "node:path";
import * as fs from "node:fs/promises";
import kleur from "kleur";
import { applyMigrations, getMigrationStatus } from "@flowpanel/core";
import { formatSuccess, formatError } from "../utils/error-format.js";

async function loadConfig() {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "flowpanel.config.ts");
  try {
    const mod = await import(configPath);
    return { config: mod.flowpanel, cwd };
  } catch (err) {
    console.error(formatError({
      problem: "Failed to load flowpanel.config.ts",
      likelyCause: String(err),
      toFix: "Make sure flowpanel.config.ts exists and has no TypeScript errors",
      command: "npx flowpanel doctor",
    }));
    process.exit(1);
  }
}

export async function runMigrate(): Promise<void> {
  const { config, cwd } = await loadConfig();
  const db = await config.getDb();

  const builtinMigrationsDir = path.resolve(new URL(import.meta.url).pathname, "../../../../../../core/migrations");
  const userMigrationsDir = path.join(cwd, "flowpanel", "migrations");

  try {
    const { applied, skipped } = await applyMigrations(db, [builtinMigrationsDir, userMigrationsDir], (id) => {
      console.log(formatSuccess(`Applied migration: ${id}`));
    });

    if (applied.length === 0) {
      console.log(kleur.gray("  No pending migrations. Schema is up to date."));
    } else {
      console.log(formatSuccess(`Applied ${applied.length} migration(s). ${skipped.length} already applied.`));
    }
  } catch (err) {
    const message = String(err);
    if (message.includes("already exists")) {
      console.error(formatError({
        problem: "Migration failed",
        likelyCause: message,
        toFix: "Mark as applied without re-running:",
        command: "npx flowpanel migrate:resolve <id> --mark-applied",
        docsUrl: "https://flowpanel.dev/errors/column-already-exists",
      }));
    } else {
      console.error(formatError({
        problem: "Migration failed",
        likelyCause: message,
        toFix: "Inspect with: npx flowpanel diff",
      }));
    }
    process.exit(1);
  }
}

export async function runMigrateGen(): Promise<void> {
  const { config, cwd } = await loadConfig();
  const { generateSchema } = await import("@flowpanel/core");

  const newSql = generateSchema({ pipeline: config.config.pipeline });
  const migDir = path.join(cwd, "flowpanel", "migrations");
  await fs.mkdir(migDir, { recursive: true });

  const files = await fs.readdir(migDir).catch(() => [] as string[]);
  const nums = files
    .filter((f) => /^\d{4}_/.test(f))
    .map((f) => parseInt(f.slice(0, 4)));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const id = String(next).padStart(4, "0") + "_schema_update";
  const outPath = path.join(migDir, `${id}.sql`);

  await fs.writeFile(outPath, newSql, "utf8");
  console.log(formatSuccess(`Generated: flowpanel/migrations/${id}.sql`));
  console.log(kleur.gray("  Review the file then run: npx flowpanel migrate"));
}

export async function runMigrateStatus(): Promise<void> {
  const { config, cwd } = await loadConfig();
  const db = await config.getDb();

  const builtinDir = path.resolve(new URL(import.meta.url).pathname, "../../../../../../core/migrations");
  const userDir = path.join(cwd, "flowpanel", "migrations");

  const { applied, pending } = await getMigrationStatus(db, [builtinDir, userDir]);

  if (applied.length > 0) {
    console.log("\n  Applied:");
    for (const id of applied) {
      console.log(kleur.green(`    ✓ ${id}`));
    }
  }
  if (pending.length > 0) {
    console.log("\n  Pending:");
    for (const id of pending) {
      console.log(kleur.yellow(`    ○ ${id}`));
    }
  }
  if (applied.length === 0 && pending.length === 0) {
    console.log(kleur.gray("  No migrations found."));
  }
}
