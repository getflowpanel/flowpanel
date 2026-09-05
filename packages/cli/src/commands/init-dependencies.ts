import type { PmCommands } from "../utils/detect";
import { cliCompatibilityError, pinnedSpec } from "../utils/kit";
import type { DependencyInspection } from "../utils/project-packages";

export interface DependencyRequirement {
  pkg: string;
  dev: boolean;
}

export interface InspectedDependency {
  dependency: DependencyRequirement;
  state: DependencyInspection;
}

export interface InstallAttempt {
  package: string;
  command: string[];
  code: number;
  reason?: string;
}

export interface DependencyReport {
  ok: boolean;
  installed: Array<{ package: string; version: string }>;
  failed: string[];
  recovery: string[];
  reason: string | null;
  /** The manager failed over something else, and FlowPanel's own packages are fine. */
  warning: string | null;
}

export type InspectDependency = (cwd: string, name: string) => Promise<DependencyInspection>;
export type RunInstall = (
  bin: string,
  args: string[],
  cwd: string,
) => Promise<{ code: number; output: string }>;

/** The last few meaningful lines of a failed install, which is where the cause lives. */
export function installFailureReason(output: string): string | null {
  const lines = output
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;
  return lines.slice(-8).join("\n");
}

export async function inspectRequirements(
  cwd: string,
  requirements: ReadonlyArray<DependencyRequirement>,
  inspect: InspectDependency,
): Promise<InspectedDependency[]> {
  return Promise.all(
    requirements.map(async (dependency) => ({
      dependency,
      state: await inspect(cwd, dependency.pkg),
    })),
  );
}

export function missingDependencies(
  inspected: ReadonlyArray<InspectedDependency>,
): InspectedDependency[] {
  return inspected.filter(({ state }) => state.installed === null);
}

/**
 * A declaration may be a workspace/file/tag/range pin the user chose, and a plain
 * install honours it. A peer declaration is not one a manager installs, so it
 * still needs an add.
 */
function installsAsDeclared({ state }: InspectedDependency): boolean {
  return state.declaration !== null && state.declaration.section !== "peerDependencies";
}

function installArgs(entry: InspectedDependency, pmc: PmCommands): string[] {
  return installsAsDeclared(entry)
    ? ["install"]
    : pmc.add(pinnedSpec(entry.dependency.pkg), entry.dependency.dev);
}

function recoveryFor(entry: InspectedDependency, pm: string, pmc: PmCommands) {
  return installsAsDeclared(entry)
    ? `${pm} install`
    : pmc.addDisplay(pinnedSpec(entry.dependency.pkg), entry.dependency.dev);
}

/**
 * Installs what is missing, re-checking before each later command: one plain
 * `install` commonly resolves every requirement at once.
 */
export async function installMissing(input: {
  cwd: string;
  pm: string;
  pmc: PmCommands;
  missing: ReadonlyArray<InspectedDependency>;
  inspect: InspectDependency;
  run: RunInstall;
}): Promise<{ attempts: InstallAttempt[]; failure: string | null }> {
  const attempts: InstallAttempt[] = [];
  for (const entry of input.missing) {
    if (attempts.length > 0) {
      const current = await input.inspect(input.cwd, entry.dependency.pkg);
      if (current.installed !== null) continue;
    }
    const args = installArgs(entry, input.pmc);
    const result = await input.run(input.pm, args, input.cwd);
    const reason = result.code === 0 ? null : installFailureReason(result.output);
    attempts.push({
      package: entry.dependency.pkg,
      command: [input.pm, ...args],
      code: result.code,
      ...(reason ? { reason } : {}),
    });
    if (result.code !== 0) {
      return { attempts, failure: reason ?? `The ${input.pm} install command failed.` };
    }
  }
  return { attempts, failure: null };
}

/**
 * Every reason init is incomplete, not only unresolved packages: a package that
 * installed but cannot work with this CLI is a failure with its own recovery.
 */
export function dependencyReport(input: {
  after: ReadonlyArray<InspectedDependency>;
  pm: string;
  pmc: PmCommands;
  installFailure: string | null;
  kitMismatch: string | null;
}): DependencyReport {
  const failed: string[] = [];
  const recovery: string[] = [];
  const details: string[] = [];
  const add = (pkg: string, detail: string, command: string) => {
    if (!failed.includes(pkg)) failed.push(pkg);
    if (!recovery.includes(command)) recovery.push(command);
    details.push(detail);
  };

  const unresolved = missingDependencies(input.after);
  const hasUnresolved = unresolved.length > 0;
  for (const entry of unresolved) {
    const pkg = entry.dependency.pkg;
    const detail =
      entry.state.error === "invalid-manifest"
        ? `${pkg} is installed in this project but its package manifest cannot be read.`
        : `The package manager completed, but ${pkg} did not resolve in this project.`;
    add(pkg, detail, recoveryFor(entry, input.pm, input.pmc));
  }

  const installedKit = input.after.find(({ dependency }) => dependency.pkg === "@flowpanel/kit")
    ?.state.installed;
  if (installedKit && input.kitMismatch) {
    add(
      "@flowpanel/kit",
      input.kitMismatch,
      input.pmc.addDisplay(pinnedSpec("@flowpanel/kit"), false),
    );
  }

  const installedCli = input.after.find(({ dependency }) => dependency.pkg === "@flowpanel/cli")
    ?.state.installed;
  const cliMismatch = cliCompatibilityError(installedCli?.version ?? null, input.pmc);
  if (cliMismatch) {
    add("@flowpanel/cli", cliMismatch, input.pmc.addDisplay(pinnedSpec("@flowpanel/cli"), true));
  }

  // A manager that exits non-zero over an unrelated package still leaves
  // FlowPanel installable. Say what it said, but do not invent a failure with
  // no failing package and no command to run.
  const ok = failed.length === 0;
  return {
    ok,
    installed: input.after.flatMap(({ dependency, state }) =>
      state.installed ? [{ package: dependency.pkg, version: state.installed.version }] : [],
    ),
    failed,
    recovery,
    // A package that never arrived is explained by the manager; one that arrived
    // and does not fit is explained by the mismatch.
    reason: ok ? null : ((hasUnresolved ? input.installFailure : null) ?? details[0] ?? null),
    warning: ok ? input.installFailure : null,
  };
}
