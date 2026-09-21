import type { Command } from "commander";
import pc from "picocolors";
import { printConfigWarnings, readConfigWarnings } from "../doctor/config-warnings";
import { type Check, runDoctorChecks } from "../doctor/run-checks";
import { publicPlan } from "../plan/filesystem-plan";
import { log } from "../utils/log";
import { writeJson } from "../utils/output";

export { type Check, runDoctorChecks };

export function doctorCommand(cli: Command): void {
  cli
    .command("doctor")
    .description("Check FlowPanel health and wiring")
    .option("--fix", "Auto-fix missing route files from templates")
    .option("--dry-run", "Show fixes without writing (use with --fix)")
    .option("--json", "Emit machine-readable JSON")
    .option("--path <url>", "Resolved admin URL when the config uses a dynamic path")
    .action(async (opts: { fix?: boolean; dryRun?: boolean; json?: boolean; path?: string }) => {
      const cwd = process.cwd();
      const { checks, bad, plan, fixBlocked } = await runDoctorChecks(cwd, opts.fix ?? false, {
        applyFixes: !opts.dryRun,
        quiet: opts.json ?? false,
        ...(opts.path ? { adminPath: opts.path } : {}),
      });

      if (opts.json) {
        writeJson({
          command: "doctor",
          ok: bad === 0,
          checks: checks.map(({ name, ok, hint }) => ({ name, ok, ...(hint ? { hint } : {}) })),
          ...(plan ? { fixes: publicPlan(plan), applied: !opts.dryRun } : {}),
          ...(fixBlocked ? { fixBlocked } : {}),
        });
        process.exit(bad === 0 ? 0 : 1);
      }

      for (const r of checks) {
        if (r.ok) log.ok(r.name);
        else {
          log.err(r.name);
          if (r.hint) process.stdout.write(`    ${pc.dim(r.hint)}\n`);
        }
      }

      if (plan && opts.dryRun) {
        process.stdout.write(`\n${pc.bold("Fixes (dry run — nothing written):")}\n`);
        for (const operation of publicPlan(plan).operations) {
          process.stdout.write(`  ${operation.kind.padEnd(6)} ${operation.path}\n`);
        }
      }

      printConfigWarnings(await readConfigWarnings(cwd));
      process.stdout.write("\n");
      if (bad === 0) log.ok(pc.bold("All checks passed."));
      else log.err(pc.bold(`${bad} issue${bad === 1 ? "" : "s"} found.`));
      process.exit(bad === 0 ? 0 : 1);
    });
}
