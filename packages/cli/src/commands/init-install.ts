import { spawn } from "node:child_process";
import { redactDiagnostic } from "../utils/fail";
import { kitCompatibilityError, pinnedSpec } from "../utils/kit";
import { inspectDependency } from "../utils/project-packages";
import type { InitRun } from "./init-context";
import {
  type DependencyReport,
  type DependencyRequirement,
  dependencyReport,
  type InstallAttempt,
  inspectRequirements,
  installMissing,
  missingDependencies,
} from "./init-dependencies";
import type { InitProject } from "./init-detect";

const REQUIRED_DEPS: ReadonlyArray<DependencyRequirement> = [
  { pkg: "@flowpanel/kit", dev: false },
  { pkg: "@flowpanel/cli", dev: true },
];

// Output is captured, not discarded: a failure's reason is almost always one line of stderr.
function runInstall(
  bin: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const windows = process.platform === "win32";
    const child = spawn(windows ? `${bin}.cmd` : bin, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: windows,
    });
    let output = "";
    let pending = "";
    let discardLine = false;
    const appendLine = (line: string) => {
      output = Buffer.from(`${output}${redactDiagnostic(line)}`)
        .subarray(-4_096)
        .toString();
    };
    const capture = (data: Buffer) => {
      pending += data.toString();
      let newline = pending.indexOf("\n");
      while (newline !== -1) {
        if (!discardLine) appendLine(pending.slice(0, newline + 1));
        pending = pending.slice(newline + 1);
        discardLine = false;
        newline = pending.indexOf("\n");
      }
      if (Buffer.byteLength(pending) > 2_048) {
        pending = "";
        discardLine = true;
      }
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.on("close", (code) => {
      if (!discardLine && pending) appendLine(pending);
      resolve({ code: code ?? 1, output });
    });
    child.on("error", (e) => resolve({ code: 1, output: redactDiagnostic(e.message) }));
  });
}

export interface InstallOutcome {
  attempts: InstallAttempt[];
  dependencies: DependencyReport;
}

/** Adds @flowpanel/kit and @flowpanel/cli when the project lacks them, then checks both fit this CLI. */
export async function installDependencies(
  run: InitRun,
  project: InitProject,
): Promise<InstallOutcome> {
  const { cwd } = run;
  const { pm, pmc } = project;
  const missing = missingDependencies(
    await inspectRequirements(cwd, REQUIRED_DEPS, inspectDependency),
  );
  let attempts: InstallAttempt[] = [];
  let installFailure: string | null = null;
  if (missing.length > 0) {
    const names = missing
      .map(({ dependency, state }) => state.declaration?.specifier ?? pinnedSpec(dependency.pkg))
      .join(", ");
    const step = run.ui.step(`Installing ${names} with ${pm}`);
    const outcome = await installMissing({
      cwd,
      pm,
      pmc,
      missing,
      inspect: inspectDependency,
      run: runInstall,
    });
    attempts = outcome.attempts;
    installFailure = outcome.failure;
    if (installFailure === null) step.done(`Installed ${names}`);
    else step.failed("Dependency install failed");
  }
  return {
    attempts,
    dependencies: dependencyReport({
      after: await inspectRequirements(cwd, REQUIRED_DEPS, inspectDependency),
      pm,
      pmc,
      installFailure,
      kitMismatch: await kitCompatibilityError(cwd),
    }),
  };
}
