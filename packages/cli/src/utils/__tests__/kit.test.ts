import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import cliPkg from "../../../package.json" with { type: "json" };
import { CLI_VERSION, installedKitVersion, kitCompatibilityError, pinnedSpec } from "../kit";

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
    // `~x.y.z` is >=x.y.z <x.(y+1).0 — never an earlier minor, unlike a bare name.
    expect(pinnedSpec("@flowpanel/kit")).toMatch(/@~\d+\.\d+\.\d/);
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

  it("names both versions and the upgrade command on a minor mismatch", async () => {
    const bumped = `${Number(CLI_VERSION.split(".")[0]) + 1}.0.0`;
    await installKit(tmp, bumped);
    const message = await kitCompatibilityError(tmp);
    expect(message).toContain(`@flowpanel/kit ${bumped}`);
    expect(message).toContain(`@flowpanel/cli ${CLI_VERSION}`);
    expect(message).toContain(pinnedSpec("@flowpanel/kit"));
  });
});
