// Node.js version guard — must be before imports
const [major] = process.versions.node.split(".").map(Number);
if (major !== undefined && major < 18) {
  console.error(
    `FlowPanel requires Node.js 18 or later. Current: ${process.version}\nUpgrade: https://nodejs.org/`,
  );
  process.exit(1);
}

import { Command } from "commander";
import kleur from "kleur";
import { runAuditExport } from "./commands/audit-export";
import { runDemo } from "./commands/demo";
import { runDemoClear } from "./commands/demo-clear";
import { runDev } from "./commands/dev";
import { runDiff } from "./commands/diff";
import { runDoctor } from "./commands/doctor";
import { runInit } from "./commands/init";
import { runMigrate, runMigrateGen, runMigrateStatus } from "./commands/migrate";
import { runStatus } from "./commands/status";
import { runWorkerScan } from "./commands/worker-scan";
import { checkForUpdates } from "./updateChecker";

const program = new Command()
  .name("flowpanel")
  .description("FlowPanel CLI — pipeline admin for Next.js")
  .version("0.1.0");

program.option("--json", "Output results as JSON");

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
  .action((opts) => runDoctor({ prod: opts.prod ?? false, json: program.opts().json ?? false }));

program
  .command("diff")
  .description("Show config ↔ DB schema drift")
  .action(() => runDiff());

program.command("demo").description("Seed 500 realistic demo runs").action(runDemo);

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
  .description("Watch config and auto-validate on changes")
  .option("--port <port>", "Dev server port", "3000")
  .action(runDev);

program
  .command("status")
  .description("Quick overview: runs, schema health, last run, dashboard URL")
  .action(() => runStatus({ json: program.opts().json ?? false }));

program.addHelpText(
  "after",
  `
${kleur.bold("Command groups")}

  ${kleur.cyan("Getting started:")}  init · demo · dev
  ${kleur.cyan("Database:")}         migrate · migrate:status · migrate:gen
  ${kleur.cyan("Diagnostics:")}      status · doctor · diff
  ${kleur.cyan("Maintenance:")}      worker:scan · audit:export · demo:clear

Run ${kleur.bold("flowpanel <command> --help")} for command-specific options.
Docs: ${kleur.cyan("https://flowpanel.dev")}
`,
);

program.parse();

checkForUpdates("0.1.0");
