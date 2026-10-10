import type { Command } from "commander";
import pc from "picocolors";
import { publicPlan } from "../plan/filesystem-plan";
import { readAdminMount } from "../utils/admin-path";
import { planLines, writeJson, writePlanJson } from "../utils/output";
import {
  confirmAndApply,
  createInitRun,
  type InitOptions,
  type InitRun,
  wrapNotice,
} from "./init-context";
import { detectStack, findInitProject, type InitProject } from "./init-detect";
import { planDevAuthOnProject } from "./init-dev-auth";
import { installDependencies } from "./init-install";
import { chooseModules } from "./init-modules";
import { adminUrl, authNotice } from "./init-output";
import { planInit } from "./init-plan";
import { printDryRun, reportInit, reportWritten } from "./init-report";

/** `init --dev-auth` on a project init already set up: only the session module changes. */
async function devAuthOnProject(run: InitRun, project: InitProject): Promise<void> {
  const planned = await planDevAuthOnProject(run.cwd);
  if (planned.kind === "refuse") run.fail(planned.message);
  const { file, plan } = planned;
  if (run.opts.dryRun) {
    if (run.opts.json) writePlanJson("init", plan, false, { authentication: "development" });
    else {
      run.ui.note(planLines(plan), "Filesystem plan (no changes applied)");
      run.ui.outro(pc.dim("Dry run complete."));
    }
    return;
  }
  const changes = plan.operations.some((op) => op.kind !== "skip");
  const written = await confirmAndApply(run, plan, changes);
  if (written === null) return;
  if (run.opts.json) {
    writeJson({
      command: "init",
      applied: written.length > 0,
      files: { applied: written },
      authentication: "development",
      plan: publicPlan(plan),
    });
    return;
  }
  if (written.length > 0) reportWritten(run, written);
  else run.ui.ok(`${file} is already the development identity; nothing changed.`);
  run.ui.warn(wrapNotice(run, authNotice({ kind: "dev-stub", file }, project.pmc) ?? ""));
  run.ui.outro(`Admin: ${pc.cyan(adminUrl((await readAdminMount(run.cwd)).path ?? "/admin"))}`);
}

async function init(opts: InitOptions): Promise<void> {
  const run = createInitRun(opts);
  const project = await findInitProject(run);
  if (opts.devAuth && project.existingConfig !== null) {
    await devAuthOnProject(run, project);
    return;
  }
  const stack = await detectStack(run, project);
  const modules = await chooseModules(run, stack);
  const planned = await planInit(run, stack, modules);
  if (opts.dryRun) {
    printDryRun(run, stack, modules, planned);
    return;
  }
  const written = await confirmAndApply(run, planned.plan, true);
  if (written === null) return;
  reportWritten(run, written);
  const install = await installDependencies(run, project);
  await reportInit(run, stack, planned, written, install);
}

export function initCommand(cli: Command): void {
  cli
    .command("init")
    .description("Initialize FlowPanel in this project")
    .option("--yes", "Accept detected defaults without prompting (CI mode)")
    .option("--dry-run", "Print the filesystem plan without writing or installing")
    .option("--json", "Emit machine-readable JSON (implies --yes)")
    .option("--path <path>", "Mount the admin at a static path, for example /ops/admin")
    .option("--db <module>", "Local module exporting your db or prisma client")
    .option("--schema <module>", "Local module exporting your Drizzle schema")
    .option("--auth <module>", "Local module exporting getSession(request)")
    .option("--dev-auth", "Explicitly use an open development-only admin identity")
    .action(init);
}
