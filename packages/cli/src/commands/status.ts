import * as path from "node:path";
import kleur from "kleur";
import { formatError, formatSuccess } from "../utils/error-format.js";

interface StatusResult {
  configFound: boolean;
  stages: string[];
  migrationsApplied: number;
  totalRuns: number;
}

export async function runStatus(opts: { json: boolean }): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "flowpanel.config.ts");

  const result: StatusResult = {
    configFound: false,
    stages: [],
    migrationsApplied: 0,
    totalRuns: 0,
  };

  try {
    const mod = await import(configPath);
    const config = mod.flowpanel;
    result.configFound = true;
    result.stages = (config.config.pipeline.stages as string[]) ?? [];

    try {
      const db = await config.getDb();
      const migRows = await db.execute("SELECT count(*)::int AS cnt FROM flowpanel_migrations");
      result.migrationsApplied = migRows.rows?.[0]?.cnt ?? 0;

      const runRows = await db.execute("SELECT count(*)::int AS cnt FROM flowpanel_runs");
      result.totalRuns = runRows.rows?.[0]?.cnt ?? 0;
    } catch {
      // DB not reachable — report what we can
    }
  } catch {
    // Config not found
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(kleur.bold("\n  FlowPanel Status\n"));

  if (result.configFound) {
    console.log(formatSuccess(`Config found`));
    console.log(kleur.gray(`    Stages: ${result.stages.join(", ")}`));
    console.log(kleur.gray(`    Migrations applied: ${result.migrationsApplied}`));
    console.log(kleur.gray(`    Total runs: ${result.totalRuns}`));
  } else {
    console.log(kleur.yellow("  ○ No flowpanel.config.ts found"));
    console.log(kleur.gray("    Run: npx flowpanel init"));
  }

  console.log("");
}
