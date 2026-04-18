import kleur from "kleur";
import { loadConfig } from "../loadConfig";

interface StatusJson {
  app: string;
  adapter: "postgres" | "sqlite" | "unknown";
  runs: { total: number; running: number };
  schema: { tablesFound: number };
  dashboard: string;
  lastRun: { stage: string; status: string; ago: string } | null;
}

export async function runStatus(opts: { json?: boolean } = {}): Promise<void> {
  const json = opts.json ?? false;

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: `Could not load flowpanel.config.ts: ${err}` }));
    } else {
      console.error(kleur.red(`\n  Could not load flowpanel.config.ts\n  ${err}\n`));
    }
    process.exit(1);
  }

  const db = await config.getDb();
  if (!db) {
    if (json) {
      console.log(JSON.stringify({ error: "No adapter configured" }));
    } else {
      console.error(kleur.red("\n  No adapter configured in flowpanel.config.ts\n"));
    }
    process.exit(1);
  }

  // Totals
  let total = 0;
  let running = 0;
  try {
    const rows = await db.execute<{ total: string | number; running: string | number }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'running') AS running
       FROM flowpanel_pipeline_run`,
      [],
    );
    total = Number(rows[0]?.total ?? 0);
    running = Number(rows[0]?.running ?? 0);
  } catch {
    // Schema not migrated yet — leave as 0
  }

  // Last run
  let lastRun: StatusJson["lastRun"] = null;
  try {
    const rows = await db.execute<{ stage: string; status: string; started_at: Date | string }>(
      `SELECT stage, status, started_at
       FROM flowpanel_pipeline_run
       ORDER BY started_at DESC
       LIMIT 1`,
      [],
    );
    if (rows[0]) {
      const row = rows[0];
      const startedMs = new Date(row.started_at).getTime();
      const ago = formatAgo(Date.now() - startedMs);
      lastRun = { stage: row.stage, status: row.status, ago };
    }
  } catch {
    // Ignore
  }

  // Schema health
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
    // Ignore
  }

  const basePath = config.config.basePath ?? "/admin";
  const dashboard = `http://localhost:3000${basePath}`;
  const adapter = (db.dialect ?? "unknown") as StatusJson["adapter"];

  if (json) {
    const out: StatusJson = {
      app: config.config.appName ?? "unknown",
      adapter,
      runs: { total, running },
      schema: { tablesFound: tableCount },
      dashboard,
      lastRun,
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const schemaOk = tableCount >= 5;
  const schemaLabel = schemaOk
    ? kleur.green("✓ up to date")
    : kleur.yellow(`⚠ ${tableCount}/5 tables (run migrate)`);

  console.log(kleur.bold("\nFlowPanel Status\n"));
  console.log(`  ${kleur.gray("App:       ")} ${config.config.appName ?? kleur.gray("(unnamed)")}`);
  console.log(`  ${kleur.gray("Adapter:   ")} ${adapter}`);
  console.log(
    `  ${kleur.gray("Runs:      ")} ${total.toLocaleString()} total ${running > 0 ? kleur.cyan(`(${running} running)`) : ""}`,
  );
  console.log(`  ${kleur.gray("Health:    ")} ${schemaLabel}`);
  console.log(`  ${kleur.gray("Dashboard: ")} ${kleur.cyan(dashboard)}`);

  if (lastRun) {
    const statusColor =
      lastRun.status === "succeeded"
        ? kleur.green
        : lastRun.status === "failed"
          ? kleur.red
          : kleur.yellow;
    console.log(
      `  ${kleur.gray("Last run:  ")} ${lastRun.ago} ago (${lastRun.stage}, ${statusColor(lastRun.status)})`,
    );
  } else if (total === 0) {
    console.log(
      `  ${kleur.gray("Last run:  ")} ${kleur.gray("none yet — try")} ${kleur.cyan("flowpanel demo")}`,
    );
  }

  console.log();
}

function formatAgo(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}
