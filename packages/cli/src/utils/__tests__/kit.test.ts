import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import semver from "semver";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import cliPkg from "../../../package.json" with { type: "json" };
import { pmCommands } from "../detect";
import {
  CLI_VERSION,
  cliCompatibilityError,
  installedKitVersion,
  kitCompatibilityError,
  pinnedSpec,
} from "../kit";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-kit-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function installKit(dir: string, version: string): Promise<void> {
  const kit = path.join(dir, "node_modules/@flowpanel/kit");
  await fs.mkdir(kit, { recursive: true });
  await fs.writeFile(
    path.join(kit, "package.json"),
    JSON.stringify({ name: "@flowpanel/kit", version }),
  );
}

describe("pinnedSpec", () => {
  it("pins to the CLI's own version", () => {
    expect(CLI_VERSION).toBe(cliPkg.version);
    expect(pinnedSpec("@flowpanel/kit")).toBe(`@flowpanel/kit@~${cliPkg.version}`);
    expect(pinnedSpec("@flowpanel/cli")).toBe(`@flowpanel/cli@~${cliPkg.version}`);
  });

  it("uses a range that cannot resolve to an older minor", () => {
    const range = pinnedSpec("@flowpanel/kit").split("@").pop() as string;
    const [major, minor, patch] = CLI_VERSION.split(".").map(Number) as [number, number, number];
    expect(semver.satisfies(CLI_VERSION, range)).toBe(true);
    expect(semver.satisfies(`${major}.${minor}.${patch + 1}`, range)).toBe(true);
    expect(semver.satisfies(`${major}.${minor + 1}.0`, range)).toBe(false);
    if (minor > 0) expect(semver.satisfies(`${major}.${minor - 1}.99`, range)).toBe(false);
    if (major > 0) expect(semver.satisfies(`${major - 1}.99.99`, range)).toBe(false);
  });
});

describe("installedKitVersion", () => {
  it("reads the version from node_modules", async () => {
    await installKit(tmp, "9.9.9");
    expect(await installedKitVersion(tmp)).toBe("9.9.9");
  });

  it("is null when the kit is not installed", async () => {
    expect(await installedKitVersion(tmp)).toBeNull();
  });

  it("uses the installed kit's version when suggesting a matching CLI", async () => {
    await installKit(tmp, "9.8.7");
    const message = await kitCompatibilityError(tmp);
    expect(message).toContain("@flowpanel/cli@~9.8.7");
  });
});

describe("kitCompatibilityError", () => {
  it("passes when the kit is not installed at all", async () => {
    expect(await kitCompatibilityError(tmp)).toBeNull();
  });

  it("passes on the CLI's own version", async () => {
    await installKit(tmp, CLI_VERSION);
    expect(await kitCompatibilityError(tmp)).toBeNull();
  });

  it("passes on a different patch of the same minor", async () => {
    const [major, minor] = CLI_VERSION.split(".");
    await installKit(tmp, `${major}.${minor}.99`);
    expect(await kitCompatibilityError(tmp)).toBeNull();
  });

  it("accepts a same-minor FlowPanel preview but rejects an invalid kit manifest version", async () => {
    const [major, minor] = CLI_VERSION.split(".");
    await installKit(tmp, `${major}.${minor}.1-quality.0`);
    expect(await kitCompatibilityError(tmp)).toBeNull();
    await installKit(tmp, "invalid");
    expect(await kitCompatibilityError(tmp)).toContain("invalid installed version");
  });

  it("names both versions and the upgrade command on a minor mismatch", async () => {
    const bumped = `${Number(CLI_VERSION.split(".")[0]) + 1}.0.0`;
    await installKit(tmp, bumped);
    const message = await kitCompatibilityError(tmp);
    expect(message).toContain(`@flowpanel/kit ${bumped}`);
    expect(message).toContain(`@flowpanel/cli ${CLI_VERSION}`);
    expect(message).toContain(pinnedSpec("@flowpanel/kit"));
  });
});

describe("cliCompatibilityError", () => {
  const pmc = pmCommands("pnpm");

  it("passes when no project-local CLI is installed", () => {
    expect(cliCompatibilityError(null, pmc)).toBeNull();
  });

  it("passes on the running version, another patch, and a same-minor preview", () => {
    const [major, minor] = CLI_VERSION.split(".");
    expect(cliCompatibilityError(CLI_VERSION, pmc)).toBeNull();
    expect(cliCompatibilityError(`${major}.${minor}.99`, pmc)).toBeNull();
    expect(cliCompatibilityError(`${major}.${minor}.1-quality.20260908`, pmc)).toBeNull();
  });

  it("names both versions and two ways out on a minor mismatch", () => {
    const bumped = `${Number(CLI_VERSION.split(".")[0]) + 1}.0.0`;
    const message = cliCompatibilityError(bumped, pmc);
    expect(message).toContain(`@flowpanel/cli ${bumped}`);
    expect(message).toContain(`this run is ${CLI_VERSION}`);
    expect(message).toContain(`pnpm add -D ${pinnedSpec("@flowpanel/cli")}`);
    expect(message).toContain("pnpm exec flowpanel init");
  });

  it("uses each manager's own way to run the project CLI", () => {
    const bumped = `${Number(CLI_VERSION.split(".")[0]) + 1}.0.0`;
    expect(cliCompatibilityError(bumped, pmCommands("npm"))).toContain("npx flowpanel init");
    expect(cliCompatibilityError(bumped, pmCommands("yarn"))).toContain("yarn flowpanel init");
    expect(cliCompatibilityError(bumped, pmCommands("bun"))).toContain("bunx flowpanel init");
  });

  it("reports an unreadable installed version instead of comparing it", () => {
    expect(cliCompatibilityError("not-a-version", pmc)).toContain("invalid installed version");
  });
});
