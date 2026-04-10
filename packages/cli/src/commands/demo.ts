import * as path from "node:path";
import kleur from "kleur";
import { formatError, formatSuccess } from "../utils/error-format.js";

export async function runDemo(): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "flowpanel.config.ts");

  console.log(kleur.bold("\n  Seeding demo data...\n"));

  try {
    const mod = await import(configPath);
    const config = mod.flowpanel;
    const db = await config.getDb();

    const stages = config.config.pipeline.stages as string[];
    const total = 500;
    let inserted = 0;

    for (let i = 0; i < total; i++) {
      const stage = stages[Math.floor(Math.random() * stages.length)];
      const status = Math.random() > 0.1 ? "completed" : "failed";
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      await db.execute(
        `INSERT INTO flowpanel_runs (stage, status, created_at, updated_at) VALUES ($1, $2, $3, $3)`,
        [stage, status, createdAt.toISOString()],
      );
      inserted++;
    }

    console.log(formatSuccess(`Inserted ${inserted} demo runs across ${stages.length} stages`));
    console.log(kleur.gray("  Clear with: npx flowpanel demo:clear\n"));
  } catch (err) {
    console.error(
      formatError({
        problem: "Failed to seed demo data",
        likelyCause: String(err),
        toFix: "Make sure flowpanel.config.ts exists and database is accessible",
        command: "npx flowpanel doctor",
      }),
    );
    process.exit(1);
  }
}
