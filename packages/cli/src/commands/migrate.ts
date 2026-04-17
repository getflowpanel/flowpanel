import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import { applyMigrations, getMigrationStatus } from "@flowpanel/core";
import kleur from "kleur";
import ora from "ora";
import { loadConfig } from "../loadConfig";
import { formatError } from "../utils/error-format";

const require = createRequire(import.meta.url);
const coreMigrationsDir = `${path.dirname(require.resolve("@flowpanel/core/package.json"))}/migrations`;

export async function runMigrate(opts: { dryRun?: boolean } = {}): Promise<void> {
  const spinner = ora("Loading config...").start();

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    spinner.fail(String(err));
    process.exit(1);
  }

  const userMigrationsDir = path.join(process.cwd(), "flowpanel", "migrations");

  if (opts.dryRun) {
    spinner.text = "Loading migration status...";
    try {
      const db = await config.getDb();
      const { pending } = await getMigrationStatus(db, [coreMigrationsDir, userMigrationsDir]);
      spinner.info("Dry run — showing SQL without applying:");
      for (const id of pending) {
        const dirs = [coreMigrationsDir, userMigrationsDir];
        let sql: string | null = null;
        for (const dir of dirs) {
          const filePath = path.join(dir, `${id}.sql`);
          try {
            sql = await fs.readFile(filePath, "utf8");
            break;
          } catch {
            // try next dir
          }
        }
        console.log(`\n${kleur.bold(kleur.cyan(`-- ${id}`))}`);
        console.log(sql ?? kleur.gray("(SQL file not found)"));
      }
      if (pending.length === 0) {
        console.log(kleur.gray("  No pending migrations."));
      }
    } catch (err) {
      spinner.fail(String(err));
      process.exit(1);
    }
    return;
  }

  try {
    spinner.text = "Connecting to database...";
    const db = await config.getDb();

    const { applied, skipped } = await applyMigrations(
      db,
      [coreMigrationsDir, userMigrationsDir],
      (id) => {
        spinner.text = `Applying ${id}...`;
      },
    );

    if (applied.length === 0) {
      spinner.succeed("No pending migrations. Schema is up to date.");
    } else {
      spinner.succeed(`${applied.length} migration(s) applied. ${skipped.length} already applied.`);
    }
  } catch (err) {
    const message = String(err);
    spinner.fail(message);
    if (message.includes("already exists")) {
      console.error(
        formatError({
          problem: "Migration failed",
          likelyCause: message,
          toFix: "Mark as applied without re-running:",
          command: "npx flowpanel migrate:resolve <id> --mark-applied",
          docsUrl: "https://flowpanel.dev/errors/column-already-exists",
        }),
      );
    } else {
      console.error(
        formatError({
          problem: "Migration failed",
          likelyCause: message,
          toFix: "Inspect with: npx flowpanel diff",
        }),
      );
    }
    process.exit(1);
  }
}

export async function runMigrateGen(): Promise<void> {
  const spinner = ora("Loading config...").start();

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    spinner.fail(String(err));
    process.exit(1);
  }

  try {
    spinner.text = "Generating schema...";
    const { generateSchema } = await import("@flowpanel/core");

    const newSql = generateSchema({ pipeline: config.config.pipeline });
    const migDir = path.join(process.cwd(), "flowpanel", "migrations");
    await fs.mkdir(migDir, { recursive: true });

    const files = await fs.readdir(migDir).catch(() => [] as string[]);
    const nums = files.filter((f) => /^\d{4}_/.test(f)).map((f) => parseInt(f.slice(0, 4), 10));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const id = `${String(next).padStart(4, "0")}_schema_update`;
    const outPath = path.join(migDir, `${id}.sql`);

    spinner.text = `Writing ${id}.sql...`;
    await fs.writeFile(outPath, newSql, "utf8");
    spinner.succeed(`Generated: flowpanel/migrations/${id}.sql`);
    console.log(kleur.gray("  Review the file then run: npx flowpanel migrate"));
  } catch (err) {
    spinner.fail(String(err));
    process.exit(1);
  }
}

export async function runMigrateStatus(): Promise<void> {
  const spinner = ora("Loading config...").start();

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    spinner.fail(String(err));
    process.exit(1);
  }

  try {
    spinner.text = "Checking migration status...";
    const db = await config.getDb();

    const userDir = path.join(process.cwd(), "flowpanel", "migrations");

    const { applied, pending } = await getMigrationStatus(db, [coreMigrationsDir, userDir]);
    spinner.succeed(`${applied.length} applied, ${pending.length} pending`);

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
  } catch (err) {
    spinner.fail(String(err));
    process.exit(1);
  }
}
