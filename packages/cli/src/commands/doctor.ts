import type { Command } from "commander";
import pc from "picocolors";
import { type ConfigWarnings, printConfigWarnings } from "../doctor/config-warnings";
import { type Check, runDoctorChecks } from "../doctor/run-checks";
import { publicPlan } from "../plan/filesystem-plan";
import { log } from "../utils/log";
import { planLines, writeJson } from "../utils/output";
import { noNextProject } from "../utils/project-root";
import { failCommand } from "../utils/ui";

export { type Check, runDoctorChecks };

function jsonCheck({ name, ok, warn, info, hint }: Check) {
  return {
    name,
    ok,
    ...(warn ? { warn: true } : {}),
    ...(info ? { info: true } : {}),
    ...(hint && (!ok || warn || info) ? { hint } : {}),
  };
}

/** Every `!` line doctor printed: the checks that warn and the config's own warnings. */
export function warningCount(checks: readonly Check[], config: ConfigWarnings): number {
  const own = "unreadable" in config ? 0 : config.warnings.length;
  return checks.filter((check) => check.warn).length + own;
}

export function doctorCommand(cli: Command): void {
  cli
    .command("doctor")
    .description("Check FlowPanel health and wiring")
    .option("--fix", "Auto-fix missing route files from templates")
    .option("--dry-run", "Show fixes without writing (use with --fix)")
    .option("--json", "Emit machine-readable JSON")
    .option("--path <path>", "Resolved admin path when the config uses a dynamic one")
    .action(async (opts: { fix?: boolean; dryRun?: boolean; json?: boolean; path?: string }) => {
      const cwd = process.cwd();
      const notProject = await noNextProject(cwd);
      if (notProject) failCommand("doctor", opts.json, notProject, { ok: false });
      const {
        checks,
        bad,
        plan,
        fixBlocked,
        config: configWarnings,
      } = await runDoctorChecks(cwd, opts.fix ?? false, {
        applyFixes: !opts.dryRun,
        quiet: opts.json ?? false,
        ...(opts.path ? { adminPath: opts.path } : {}),
      });
      const warned = warningCount(checks, configWarnings);

      if (opts.json) {
        writeJson({
          command: "doctor",
          ok: bad === 0,
          checks: checks.map(jsonCheck),
          ...(plan ? { fixes: publicPlan(plan), applied: !opts.dryRun } : {}),
          ...(fixBlocked ? { fixBlocked } : {}),
          ...("unreadable" in configWarnings
            ? { configWarnings: [], configUnreadable: configWarnings.unreadable }
            : { configWarnings: configWarnings.warnings }),
        });
        process.exit(bad === 0 ? 0 : 1);
      }

      for (const r of checks) {
        if (r.warn) log.warn(r.name);
        else if (r.info) log.info(r.name);
        else if (r.ok) log.ok(r.name);
        else log.err(r.name);
        if ((!r.ok || r.warn || r.info) && r.hint) process.stdout.write(`    ${pc.dim(r.hint)}\n`);
      }

      if (plan && opts.dryRun) {
        process.stdout.write(`\n${pc.bold("Fixes (dry run — nothing written):")}\n`);
        process.stdout.write(`${planLines(plan).replace(/^/gm, "  ")}\n`);
      }

      printConfigWarnings(configWarnings);
      process.stdout.write("\n");
      if (bad > 0) log.err(pc.bold(`${bad} issue${bad === 1 ? "" : "s"} found.`));
      else if (warned > 0) {
        log.warn(pc.bold(`No failures, ${warned} warning${warned === 1 ? "" : "s"} to review.`));
      } else log.ok(pc.bold("All checks passed."));
      process.exit(bad === 0 ? 0 : 1);
    });
}
