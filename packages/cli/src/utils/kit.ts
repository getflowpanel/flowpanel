import cliPkg from "../../package.json" with { type: "json" };
import { detectPackageManager, type PmCommands, pmCommands } from "./detect";
import { inspectDependency } from "./project-packages";

export const CLI_VERSION: string = cliPkg.version;

/** Same-minor range: resolves forward within the minor, never back to an older one. */
export function pinnedSpec(pkg: string): string {
  return `${pkg}@~${CLI_VERSION}`;
}

function pinnedVersion(pkg: string, version: string): string {
  return `${pkg}@~${version}`;
}

function minorOf(version: string): string | null {
  const match = /^(\d+)\.(\d+)\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  return match ? `${match[1]}.${match[2]}` : null;
}

/** The `@flowpanel/kit` version installed under `cwd`, or `null` when it is not installed. */
export async function installedKitVersion(cwd: string): Promise<string | null> {
  return (await inspectDependency(cwd, "@flowpanel/kit")).installed?.version ?? null;
}

/**
 * `null` when the installed kit can consume what this CLI writes. Templates are
 * cut per minor and import symbols that only exist in the matching kit, so a
 * differing minor is a hard stop rather than a warning.
 */
export async function kitCompatibilityError(cwd: string): Promise<string | null> {
  const kit = await installedKitVersion(cwd);
  if (kit === null) return null;
  const kitMinor = minorOf(kit);
  const cliMinor = minorOf(CLI_VERSION);
  if (kitMinor === null)
    return `@flowpanel/kit has an invalid installed version (${kit}). Reinstall it with your project package manager.`;
  if (cliMinor === null)
    return `@flowpanel/cli has an invalid version (${CLI_VERSION}). Reinstall the CLI.`;
  if (kitMinor === cliMinor) return null;

  const pmc = pmCommands(await detectPackageManager(cwd));
  return (
    `@flowpanel/kit ${kit} does not match @flowpanel/cli ${CLI_VERSION}. ` +
    `Templates are cut per minor and will not compile against a different one.\n` +
    `  Upgrade the kit:        ${pmc.addDisplay(pinnedSpec("@flowpanel/kit"), false)}\n` +
    `  Or run the matching CLI: ${pmc.dlx} ${pinnedVersion("@flowpanel/cli", kit)}`
  );
}

/**
 * `null` when a project-local `@flowpanel/cli` can stand in for this run. The unit
 * is the minor, exactly as for the kit: a different patch or a matching preview of
 * the same minor generates the same templates, so it is not a reason to stop.
 */
export function cliCompatibilityError(installed: string | null, pmc: PmCommands): string | null {
  if (installed === null) return null;
  const installedMinor = minorOf(installed);
  if (installedMinor === null)
    return `@flowpanel/cli has an invalid installed version (${installed}). Reinstall it with your project package manager.`;
  const cliMinor = minorOf(CLI_VERSION);
  if (cliMinor === null)
    return `@flowpanel/cli has an invalid version (${CLI_VERSION}). Reinstall the CLI.`;
  if (installedMinor === cliMinor) return null;
  const local = [pmc.exec, ...pmc.execArgs("flowpanel", [])].join(" ").trim();
  return (
    `@flowpanel/cli ${installed} is installed in this project, but this run is ${CLI_VERSION}. ` +
    `Templates are cut per minor, so later commands would not match what this run wrote.\n` +
    `  Align the project: ${pmc.addDisplay(pinnedSpec("@flowpanel/cli"), true)}\n` +
    `  Or re-run with the project CLI: ${local} init`
  );
}
