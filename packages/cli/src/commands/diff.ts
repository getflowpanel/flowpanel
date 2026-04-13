import kleur from "kleur";
import { loadConfig } from "../loadConfig";

const TRPC_PROCEDURES = [
  "flowpanel.runs.list / get / retry / cancel / bulkRetry / chart / topErrors",
  "flowpanel.metrics.getAll / get",
  "flowpanel.drawers.get",
  "flowpanel.stages.summary",
  "flowpanel.users.list",
  "flowpanel.stream (SSE)",
];

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

  console.log(kleur.bold("\nFlowPanel Diff\n"));

  // ── Config ──────────────────────────────────────────────────────────────
  console.log(`  ${kleur.gray("Config:")}      flowpanel.config.ts ${kleur.green("✓")}`);

  // ── Schema table count ───────────────────────────────────────────────────
  let tableCount = 0;
  try {
    const rows = await db.execute<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count
       FROM pg_tables
       WHERE tablename LIKE 'flowpanel\\_%' ESCAPE '\\'`,
      [],
    );
    tableCount = Number(rows[0]?.count ?? 0);
  } catch {
    // Not available in non-pg environments
  }

  const schemaLabel =
    tableCount >= 5
      ? kleur.green(`${tableCount} tables (all applied)`)
      : kleur.yellow(`${tableCount}/5 tables — run: npx flowpanel migrate`);
  console.log(`  ${kleur.gray("Schema:")}      ${schemaLabel}`);

  // ── Stages ──────────────────────────────────────────────────────────────
  const stages = config.config.pipeline.stages;
  let stageCounts: Record<string, number> = {};
  try {
    const rows = await db.execute<{ stage: string; count: string | number }>(
      `SELECT stage, COUNT(*)::int AS count
       FROM flowpanel_pipeline_run
       GROUP BY stage`,
      [],
    );
    for (const row of rows) {
      stageCounts[row.stage] = Number(row.count);
    }
  } catch {
    // Table might not exist yet
  }

  console.log(`\n  ${kleur.gray("Stages:")}`);
  for (const stage of stages) {
    const count = stageCounts[stage] ?? 0;
    const countStr =
      count > 0 ? kleur.cyan(`${count.toLocaleString()} runs`) : kleur.gray("0 runs");
    console.log(`    ${kleur.green("✓")} ${stage.padEnd(16)} ${countStr}`);
  }

  // ── tRPC procedures ─────────────────────────────────────────────────────
  console.log(`\n  ${kleur.gray("tRPC procedures:")}`);
  for (const proc of TRPC_PROCEDURES) {
    console.log(`    ${kleur.gray("·")} ${proc}`);
  }

  // ── Custom fields ────────────────────────────────────────────────────────
  const globalFields = Object.keys(config.config.pipeline.fields ?? {});
  const stageFieldsMap = config.config.pipeline.stageFields ?? {};
  const stageFieldNames = [
    ...new Set(Object.values(stageFieldsMap).flatMap((f) => Object.keys(f))),
  ];
  const allCustomFields = [...new Set([...globalFields, ...stageFieldNames])];

  if (allCustomFields.length > 0) {
    console.log(
      `\n  ${kleur.gray("Custom fields:")} ${allCustomFields.join(", ")}  ${kleur.gray(`(${allCustomFields.length} fields)`)}`,
    );
  } else {
    console.log(`\n  ${kleur.gray("Custom fields:")} ${kleur.gray("none")}`);
  }

  // ── Drawers ──────────────────────────────────────────────────────────────
  const drawers = config.config.drawers ?? {};
  const drawerNames = Object.keys(drawers);
  if (drawerNames.length > 0) {
    const drawerSummary = drawerNames
      .map((name) => {
        const count = drawers[name].sections.length;
        return `${name} (${count} section${count !== 1 ? "s" : ""})`;
      })
      .join(", ");
    console.log(`  ${kleur.gray("Drawers:")}     ${drawerSummary}`);
  } else {
    console.log(`  ${kleur.gray("Drawers:")}     ${kleur.gray("none")}`);
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  const theme = config.config.theme;
  const themeparts: string[] = [];
  if (theme?.accent) themeparts.push(`accent=${theme.accent}`);
  if (theme?.radius) themeparts.push(`radius=${theme.radius}`);
  themeparts.push(`colorScheme=${theme?.colorScheme ?? "auto"}`);
  console.log(`  ${kleur.gray("Theme:")}       ${themeparts.join(", ")}`);

  // ── Column drift ─────────────────────────────────────────────────────────
  console.log(`\n  ${kleur.gray("Schema drift:")}`);

  const colRows = await db.execute<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'flowpanel_pipeline_run'
     ORDER BY ordinal_position`,
    [],
  );

  if (colRows.length === 0) {
    console.log(
      kleur.yellow("    flowpanel_pipeline_run does not exist. Run: npx flowpanel migrate"),
    );
    console.log();
    return;
  }

  const actualCols = new Set(colRows.map((r: { column_name: string }) => r.column_name));
  const expectedColMatches = expectedSql.matchAll(/^\s+(\w+)\s+\w/gm);
  const expectedCols = new Set([...expectedColMatches].map((m) => m[1]));

  const missing = [...expectedCols].filter((c) => !actualCols.has(c));
  const extra = [...actualCols].filter((c) => !expectedCols.has(c));

  if (missing.length === 0 && extra.length === 0) {
    console.log(kleur.green("    ✓ No column drift detected"));
  } else {
    if (missing.length > 0) {
      console.log(kleur.yellow("    Missing columns (in config but not in DB):"));
      for (const col of missing) {
        console.log(kleur.yellow(`      + ${col}`));
      }
    }
    if (extra.length > 0) {
      console.log(kleur.gray("    Extra columns (in DB but not in config):"));
      for (const col of extra) {
        console.log(kleur.gray(`      - ${col}`));
      }
    }
    console.log(kleur.gray("    Run: npx flowpanel migrate:gen to generate a migration"));
  }

  console.log();
}
