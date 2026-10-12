import pc from "picocolors";
import { findSessionStub } from "../doctor/session-module";
import { publicPlan } from "../plan/filesystem-plan";
import { planLines, writeJson, writePlanJson } from "../utils/output";
import { type InitRun, wrapNotice } from "./init-context";
import type { DetectedStack } from "./init-detect";
import type { InstallOutcome } from "./init-install";
import type { InitModules } from "./init-modules";
import { type AuthOutcome, adminUrl, authNotice, nextSteps } from "./init-output";
import type { InitPlan } from "./init-plan";

const SESSION_LABEL: Record<AuthOutcome["kind"], string> = {
  "closed-stub": "closed stub, denies every request",
  "dev-stub": "open development identity",
  preset: "provider preset",
  existing: "your module",
};

/** `--dry-run`: the modules the config will import and the plan, with nothing written. */
export function printDryRun(
  run: InitRun,
  stack: DetectedStack,
  modules: InitModules,
  planned: InitPlan,
): void {
  const session = "file" in planned.auth ? planned.auth.file : modules.auth;
  const schema = stack.orm === "drizzle" ? { schema: modules.schema } : {};
  if (run.opts.json) {
    writePlanJson("init", planned.plan, false, {
      modules: { db: modules.db, ...schema, session, migration: modules.dialect },
      authentication: planned.authentication,
    });
    return;
  }
  const lines = [
    `db client   ${modules.db}`,
    ...(stack.orm === "drizzle" ? [`schema      ${modules.schema}`] : []),
    `session     ${session} (${SESSION_LABEL[planned.auth.kind]})`,
    `migration   ${modules.dialect}`,
  ];
  run.ui.note(lines.join("\n"), "Modules");
  run.ui.note(planLines(planned.plan), "Filesystem plan (no changes applied)");
  run.ui.outro(pc.dim("Dry run complete."));
}

/** The files just written: listed when nobody saw the plan, counted when they confirmed it. */
export function reportWritten(run: InitRun, written: readonly string[]): void {
  if (written.length === 0) run.ui.ok("Already set up; nothing changed.");
  else if (run.unattended || !run.framed) run.ui.note(written.join("\n"), "Wrote");
  else run.ui.ok(`Wrote ${written.length} file${written.length === 1 ? "" : "s"}`);
}

/** The closing report: JSON, or the recovery when dependencies failed, else warnings, next steps and the admin URL. */
export async function reportInit(
  run: InitRun,
  stack: DetectedStack,
  planned: InitPlan,
  written: string[],
  install: InstallOutcome,
): Promise<void> {
  const { dependencies } = install;
  const stub = await findSessionStub(run.cwd);
  const auth: AuthOutcome =
    planned.auth.kind === "preset"
      ? planned.auth
      : stub
        ? { kind: stub.kind === "closed" ? "closed-stub" : "dev-stub", file: stub.file }
        : { kind: "existing" };
  const notice = authNotice(auth, stack.pmc);
  if (!dependencies.ok) process.exitCode = 1;

  if (run.opts.json) {
    writeJson({
      command: "init",
      applied: true,
      dependenciesInstalled: dependencies.ok,
      dependencies: {
        installed: dependencies.installed,
        failed: dependencies.failed,
        attempts: install.attempts,
        ...(dependencies.reason ? { reason: dependencies.reason } : {}),
        ...(dependencies.warning ? { warning: dependencies.warning } : {}),
        recovery: dependencies.recovery,
      },
      files: {
        applied: written,
        kept: publicPlan(planned.plan)
          .operations.filter((operation) => operation.kind === "skip")
          .map((operation) => operation.path),
      },
      adminPath: planned.adminPath,
      warnings: planned.warnings,
      authentication: planned.authentication,
      ...(stack.authProvider ? { authProvider: stack.authProvider } : {}),
      plan: publicPlan(planned.plan),
    });
    return;
  }

  if (!dependencies.ok) {
    const recovery = [
      ...(dependencies.reason ? [dependencies.reason] : []),
      ...dependencies.recovery,
    ];
    run.ui.warn("FlowPanel init is incomplete");
    run.ui.note(recovery.join("\n"), "To finish");
    run.ui.outro(pc.yellow("Run the commands above, then init again."));
    return;
  }
  const warnings = [
    ...(dependencies.warning
      ? [
          `${stack.pm} exited with an error while installing something else:\n${dependencies.warning}`,
        ]
      : []),
    ...(planned.manualHydrationFix
      ? [
          `Could not add suppressHydrationWarning to ${planned.manualHydrationFix}. Add it to that file's <html> tag by hand; ThemeScript sets an attribute on it before hydration.`,
        ]
      : []),
    ...(notice && auth.kind !== "preset" ? [notice] : []),
  ];
  for (const warning of warnings) run.ui.warn(wrapNotice(run, warning));
  if (notice && auth.kind === "preset") run.ui.info(wrapNotice(run, notice));
  run.ui.note(nextSteps(stack.pmc, pc, stack.orm === "prisma" ? "model" : "table"), "Next");
  run.ui.outro(`Admin: ${pc.cyan(adminUrl(planned.adminPath))}`);
}
