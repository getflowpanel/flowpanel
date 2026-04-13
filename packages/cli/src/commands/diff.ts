import kleur from "kleur";
import { loadConfig } from "../loadConfig";

export async function runDiff(): Promise<void> {
  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    console.error(kleur.red(`Failed to load flowpanel.config.ts: ${err}`));
    process.exit(1);
  }

  const { generateSchema } = await import("@flowpanel/core");
  const expectedSql = generateSchema({ pipeline: config.config.pipeline });

  // biome-ignore lint/suspicious/noExplicitAny: dynamically loaded config
  let db: any;
  try {
    db = await config.getDb();
  } catch {
    console.error(kleur.red("Database not connected. Run: npx flowpanel doctor"));
    process.exit(1);
  }

  const rows = await db.execute<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'flowpanel_pipeline_run'
     ORDER BY ordinal_position`,
    [],
  );

  if (rows.length === 0) {
    console.log(
      kleur.yellow("  flowpanel_pipeline_run does not exist. Run: npx flowpanel migrate"),
    );
    return;
  }

  const actualCols = new Set(rows.map((r) => r.column_name));

  const expectedColMatches = expectedSql.matchAll(/^\s+(\w+)\s+\w/gm);
  const expectedCols = new Set([...expectedColMatches].map((m) => m[1]));

  const missing = [...expectedCols].filter((c) => !actualCols.has(c));
  const extra = [...actualCols].filter((c) => !expectedCols.has(c));

  if (missing.length === 0 && extra.length === 0) {
    console.log(kleur.green("\n  ✓ Schema is in sync. No drift detected.\n"));
    return;
  }

  if (missing.length > 0) {
    console.log(kleur.yellow("\n  Missing columns (in config but not in DB):"));
    for (const col of missing) {
      console.log(kleur.yellow(`    + ${col}`));
    }
  }

  if (extra.length > 0) {
    console.log(kleur.gray("\n  Extra columns (in DB but not in config):"));
    for (const col of extra) {
      console.log(kleur.gray(`    - ${col}`));
    }
  }

  console.log(kleur.gray("\n  Run: npx flowpanel migrate:gen to generate a migration\n"));
}
