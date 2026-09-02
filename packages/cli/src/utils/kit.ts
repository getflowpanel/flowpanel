import * as fs from "node:fs/promises";
import * as path from "node:path";
import cliPkg from "../../package.json" with { type: "json" };
import { detectPackageManager, pmCommands } from "./detect";

export const CLI_VERSION: string = cliPkg.version;

/** Same-minor range: resolves forward within the minor, never back to an older one. */
export function pinnedSpec(pkg: string): string {
  return `${pkg}@~${CLI_VERSION}`;
}

function minorOf(version: string): string | null {
  const match = /^(\d+)\.(\d+)\./.exec(version);
  return match ? `${match[1]}.${match[2]}` : null;
}

/** The `@flowpanel/kit` version installed under `cwd`, or `null` when it is not installed. */
export async function installedKitVersion(cwd: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(cwd, "node_modules/@flowpanel/kit/package.json"), "utf8"),
    );
    if (typeof pkg?.version === "string") return pkg.version;
  } catch {
    /* not installed */
  }
  return null;
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
  if (kitMinor === null || cliMinor === null || kitMinor === cliMinor) return null;

  const pmc = pmCommands(await detectPackageManager(cwd));
  return (
    `@flowpanel/kit ${kit} does not match @flowpanel/cli ${CLI_VERSION}. ` +
    `Templates are cut per minor and will not compile against a different one.\n` +
    `  Upgrade the kit:        ${pmc.addDisplay(pinnedSpec("@flowpanel/kit"), false)}\n` +
    `  Or run the matching CLI: ${pmc.dlx} ${pinnedSpec("@flowpanel/cli")}`
  );
}
