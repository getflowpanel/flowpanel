import { Command } from "commander";
import kleur from "kleur";
import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runMigrate, runMigrateStatus } from "./commands/migrate.js";
import { runDemo } from "./commands/demo.js";
import { showContextualHelp } from "./help.js";

const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error("FlowPanel requires Node.js 18+. You are running " + process.version);
  process.exit(1);
}

const program = new Command()
  .name("flowpanel")
  .description(`${kleur.cyan("◆")} FlowPanel v0.1.0`)
  .version("0.1.0")
  .action(() => showContextualHelp());

program
  .command("init")
  .description("Add FlowPanel to your project")
  .action(() => runInit());

program
  .command("migrate")
  .description("Sync database with config")
  .option("--dry-run", "Show SQL without applying")
  .option("--status", "Show applied/pending migrations")
  .action((opts) => {
    if (opts.status) {
      return runMigrateStatus();
    }
    return runMigrate({ dryRun: opts.dryRun ?? false });
  });

program
  .command("doctor")
  .description("Check setup and troubleshoot")
  .option("--prod", "Pre-deploy security checklist (exits 1 on any failure)")
  .option("--json", "Output as JSON")
  .action((opts) => runDoctor({ prod: opts.prod ?? false }));

program
  .command("demo")
  .description("Try FlowPanel with sample data")
  .option("--port <number>", "Server port", "4400")
  .option("--clear", "Clear seeded demo data instead")
  .option("--no-open", "Do not open browser automatically")
  .action((opts) =>
    runDemo({ port: Number(opts.port), clear: opts.clear ?? false, open: opts.open ?? true }),
  );

program.parse();
