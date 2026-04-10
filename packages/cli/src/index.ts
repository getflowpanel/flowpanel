import { Command } from "commander";
import { runAuditExport } from "./commands/audit-export.js";
import { runDemoClear } from "./commands/demo-clear.js";
import { runDiff } from "./commands/diff.js";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runMigrate, runMigrateGen, runMigrateStatus } from "./commands/migrate.js";
import { runWorkerScan } from "./commands/worker-scan.js";
import { runDev } from "./commands/dev.js";
import { runDemo } from "./commands/demo.js";
import { runStatus } from "./commands/status.js";

const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error("FlowPanel requires Node.js 18+. You are running " + process.version);
  process.exit(1);
}

const program = new Command()
  .name("flowpanel")
  .description("FlowPanel CLI — pipeline admin for Next.js")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold config, page, mount tRPC, seed demo data")
  .action(() => runInit());

program
  .command("migrate")
  .description("Apply pending schema migrations")
  .option("--dry-run", "Show SQL without applying")
  .action((opts) => runMigrate({ dryRun: opts.dryRun ?? false }));

program
  .command("migrate:gen")
  .description("Generate migration from config diff")
  .action(() => runMigrateGen());

program
  .command("migrate:status")
  .description("Show applied/pending migrations")
  .action(() => runMigrateStatus());

program
  .command("doctor")
  .description("Health check: auth, schema, indexes, security, TS types")
  .option("--prod", "Pre-deploy security checklist (exits 1 on any failure)")
  .action((opts) => runDoctor({ prod: opts.prod ?? false }));

program
  .command("diff")
  .description("Show config ↔ DB schema drift")
  .action(() => runDiff());

program
  .command("demo:clear")
  .description("Remove seeded demo data")
  .action(() => runDemoClear());

program
  .command("worker:scan")
  .description("Scan processors, suggest withRun() wrapping")
  .action(() => runWorkerScan());

program
  .command("audit:export")
  .description("Export audit log to CSV or NDJSON")
  .option("--from <date>", "Start date")
  .option("--to <date>", "End date")
  .option("--format <fmt>", "csv or ndjson", "csv")
  .option("--out <file>", "Output file path")
  .action((opts) => runAuditExport(opts));

program
  .command("dev")
  .description("Watch config and validate on change")
  .action(() => runDev());

program
  .command("demo")
  .description("Seed 500 demo runs for preview")
  .action(() => runDemo());

program
  .command("status")
  .description("Quick overview of FlowPanel state")
  .option("--json", "Output as JSON")
  .action((opts) => runStatus({ json: opts.json ?? false }));

program.parse();
