import * as path from "node:path";
import kleur from "kleur";
import ora from "ora";

export async function runDiff(): Promise<void> {
  const cwd = process.cwd();
  const spinner = ora("Loading config...").start();

  let config: any;
  try {
    const { loadConfig } = await import("../loadConfig.js");
    config = await loadConfig();
    spinner.succeed("Config loaded");
  } catch (err) {
    spinner.fail(`Failed to load flowpanel.config.ts: ${err}`);
    process.exit(1);
  }

  const { generateSchema, defineFlowPanel } = await import("@flowpanel/core");
  const fp = defineFlowPanel(config);
  const expectedSql = generateSchema({ pipeline: config.pipeline });

  let db: any;
  try {
    db = await fp.getDb();
  } catch {
    console.error(kleur.red("Database not connected. Run: npx flowpanel doctor"));
    process.exit(1);
  }

  console.log(kleur.bold("\n  flowpanel diff\n"));

  // Config file
  console.log(`    Config:     ${kleur.green("flowpanel.config.ts ✓")}`);

  // Schema check
  const tables = await db.execute<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'flowpanel_%'`,
    [],
  );
  const indexes = await db
    .execute<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'flowpanel_%'`,
      [],
    )
    .catch(() => []);

  const appliedAll = tables.length >= 4;
  console.log(
    `    Schema:     ${tables.length} tables, ${indexes.length} indexes ${appliedAll ? kleur.green("(all applied)") : kleur.yellow("(pending migrations)")}`,
  );

  // Stages with run counts
  const stages: string[] = config.pipeline?.stages ?? [];
  if (stages.length > 0) {
    console.log("\n    Stages:");
    for (const stage of stages) {
      try {
        const rows = await db.execute<{ count: string }>(
          `SELECT COUNT(*) AS count FROM flowpanel_pipeline_run WHERE stage = $1`,
          [stage],
        );
        const count = Number(rows[0]?.count ?? 0);
        if (count > 0) {
          console.log(
            `      ${stage.padEnd(12)} ${kleur.green("✓")} configured, ${count.toLocaleString()} runs`,
          );
        } else {
          console.log(
            `      ${stage.padEnd(12)} ${kleur.yellow("⚠")} in config but 0 runs (unused?)`,
          );
        }
      } catch {
        console.log(`      ${stage.padEnd(12)} ${kleur.gray("?")} could not query`);
      }
    }
  }

  // tRPC endpoints
  console.log("\n    tRPC endpoints:");
  const endpoints = [
    "flowpanel.runs.list",
    "flowpanel.runs.get",
    "flowpanel.runs.chart",
    "flowpanel.runs.topErrors",
    "flowpanel.metrics.current",
    "flowpanel.stages.breakdown",
    "flowpanel.drawers.render",
    "flowpanel.stream.connect",
  ];
  for (const ep of endpoints) {
    const method = ep.includes("retry") || ep.includes("cancel") ? "POST" : "GET";
    console.log(`      ${ep.padEnd(32)} → ${kleur.gray(method)}  /api/trpc`);
  }

  // Custom fields
  const fields = Object.keys(config.pipeline?.fields ?? {});
  if (fields.length > 0) {
    console.log(`\n    Custom fields: ${fields.join(", ")} (${fields.length} fields)`);
  }

  // Drawer sections
  const drawers = config.drawers ?? {};
  const allSections = new Set<string>();
  for (const drawer of Object.values(drawers) as any[]) {
    for (const section of drawer?.sections ?? []) {
      allSections.add(section.type);
    }
  }
  if (allSections.size > 0) {
    console.log(
      `    Drawer sections: ${[...allSections].join(", ")} (${allSections.size} sections)`,
    );
  }

  // Theme
  const theme = config.theme;
  if (theme) {
    const parts = [];
    if (theme.accent) parts.push(`accent=${theme.accent}`);
    if (theme.radius != null) parts.push(`radius=${theme.radius}px`);
    if (theme.colorScheme) parts.push(`colorScheme=${theme.colorScheme}`);
    if (parts.length > 0) {
      console.log(`    Theme: ${parts.join(", ")}`);
    }
  }

  // Schema drift
  const rows = await db.execute<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
		 FROM information_schema.columns
		 WHERE table_name = 'flowpanel_pipeline_run'
		 ORDER BY ordinal_position`,
    [],
  );

  if (rows.length > 0) {
    const actualCols = new Set(rows.map((r) => r.column_name));
    const expectedColMatches = expectedSql.matchAll(/^\s+(\w+)\s+\w/gm);
    const expectedCols = new Set([...expectedColMatches].map((m) => m[1]));

    const missing = [...expectedCols].filter((c) => !actualCols.has(c));
    const extra = [...actualCols].filter((c) => !expectedCols.has(c));

    if (missing.length > 0 || extra.length > 0) {
      console.log(kleur.yellow("\n    Schema drift detected:"));
      for (const col of missing) {
        console.log(kleur.yellow(`      + ${col} (missing in DB)`));
      }
      for (const col of extra) {
        console.log(kleur.gray(`      - ${col} (extra in DB)`));
      }
      console.log(kleur.gray("\n    Run: npx flowpanel migrate:gen to generate a migration"));
    }
  }

  console.log("");
}
