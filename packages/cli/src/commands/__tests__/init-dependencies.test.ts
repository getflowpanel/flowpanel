import { describe, expect, it } from "vitest";
import { pmCommands } from "../../utils/detect";
import { CLI_VERSION } from "../../utils/kit";
import type { DependencyInspection, DependencySection } from "../../utils/project-packages";
import {
  type DependencyRequirement,
  dependencyReport,
  type InspectedDependency,
  inspectRequirements,
  installMissing,
  missingDependencies,
} from "../init-dependencies";

const KIT: DependencyRequirement = { pkg: "@flowpanel/kit", dev: false };
const CLI: DependencyRequirement = { pkg: "@flowpanel/cli", dev: true };
const pmc = pmCommands("pnpm");

function absent(
  name: string,
  specifier?: string,
  section: DependencySection = "dependencies",
): DependencyInspection {
  return {
    name,
    declaration: specifier ? { section, specifier } : null,
    installed: null,
    error: "unresolved",
  };
}

function present(name: string, version: string, specifier?: string): DependencyInspection {
  return {
    name,
    declaration: specifier ? { section: "dependencies", specifier } : null,
    installed: { directory: `/tmp/${name}`, manifest: { name, version }, version },
    error: null,
  };
}

function pair(kit: DependencyInspection, cli: DependencyInspection): InspectedDependency[] {
  return [
    { dependency: KIT, state: kit },
    { dependency: CLI, state: cli },
  ];
}

const [major, minor] = CLI_VERSION.split(".");
const sameMinorPreview = `${major}.${minor}.99-quality.0`;
const otherMinor = `${Number(major) + 1}.0.0`;

describe("installMissing", () => {
  it("stops asking the manager for a package a previous command already installed", async () => {
    const commands: string[][] = [];
    let cliInstalled = false;
    const result = await installMissing({
      cwd: "/project",
      pm: "pnpm",
      pmc,
      missing: pair(absent("@flowpanel/kit", "workspace:*"), absent("@flowpanel/cli")),
      inspect: async (_cwd, name) =>
        name === "@flowpanel/cli" && cliInstalled ? present(name, CLI_VERSION) : absent(name),
      run: async (bin, args) => {
        commands.push([bin, ...args]);
        cliInstalled = true;
        return { code: 0, output: "" };
      },
    });
    expect(commands).toEqual([["pnpm", "install"]]);
    expect(result.attempts).toHaveLength(1);
    expect(result.failure).toBeNull();
  });

  it("keeps a workspace/file/tag declaration instead of replacing it with a pinned add", async () => {
    const commands: string[][] = [];
    await installMissing({
      cwd: "/project",
      pm: "pnpm",
      pmc,
      missing: [{ dependency: KIT, state: absent("@flowpanel/kit", "file:../kit") }],
      inspect: async (_cwd, name) => absent(name),
      run: async (bin, args) => {
        commands.push([bin, ...args]);
        return { code: 0, output: "" };
      },
    });
    expect(commands).toEqual([["pnpm", "install"]]);
  });

  it("adds the pinned spec when nothing is declared", async () => {
    const commands: string[][] = [];
    await installMissing({
      cwd: "/project",
      pm: "pnpm",
      pmc,
      missing: [{ dependency: CLI, state: absent("@flowpanel/cli") }],
      inspect: async (_cwd, name) => absent(name),
      run: async (bin, args) => {
        commands.push([bin, ...args]);
        return { code: 0, output: "" };
      },
    });
    expect(commands).toEqual([["pnpm", "add", "-D", `@flowpanel/cli@~${CLI_VERSION}`]]);
  });

  it("stops at the first failure and reports the manager's own last lines", async () => {
    const result = await installMissing({
      cwd: "/project",
      pm: "pnpm",
      pmc,
      missing: pair(absent("@flowpanel/kit"), absent("@flowpanel/cli")),
      inspect: async (_cwd, name) => absent(name),
      run: async () => ({ code: 1, output: "noise\nERR_PNPM_FETCH_404 not found\n" }),
    });
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.code).toBe(1);
    expect(result.failure).toContain("ERR_PNPM_FETCH_404");
  });

  it("names the manager when a failed command printed nothing", async () => {
    const result = await installMissing({
      cwd: "/project",
      pm: "npm",
      pmc: pmCommands("npm"),
      missing: [{ dependency: KIT, state: absent("@flowpanel/kit") }],
      inspect: async (_cwd, name) => absent(name),
      run: async () => ({ code: 1, output: "" }),
    });
    expect(result.failure).toBe("The npm install command failed.");
  });
});

describe("dependencyReport", () => {
  it("is ok and lists installed versions when everything resolved", () => {
    const report = dependencyReport({
      after: pair(present("@flowpanel/kit", CLI_VERSION), present("@flowpanel/cli", CLI_VERSION)),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report).toMatchObject({ ok: true, failed: [], recovery: [], reason: null });
    expect(report.installed).toEqual([
      { package: "@flowpanel/kit", version: CLI_VERSION },
      { package: "@flowpanel/cli", version: CLI_VERSION },
    ]);
  });

  it("reports an installed but incompatible kit as a failure with its own recovery", () => {
    const report = dependencyReport({
      after: pair(present("@flowpanel/kit", otherMinor), present("@flowpanel/cli", CLI_VERSION)),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: `@flowpanel/kit ${otherMinor} does not match @flowpanel/cli ${CLI_VERSION}.`,
    });
    expect(report.ok).toBe(false);
    expect(report.failed).toEqual(["@flowpanel/kit"]);
    expect(report.recovery).toEqual([`pnpm add @flowpanel/kit@~${CLI_VERSION}`]);
    expect(report.reason).toContain(otherMinor);
  });

  it("reports an incompatible project-local CLI as a failure with its own recovery", () => {
    const report = dependencyReport({
      after: pair(present("@flowpanel/kit", CLI_VERSION), present("@flowpanel/cli", otherMinor)),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.ok).toBe(false);
    expect(report.failed).toEqual(["@flowpanel/cli"]);
    expect(report.recovery).toEqual([`pnpm add -D @flowpanel/cli@~${CLI_VERSION}`]);
    expect(report.reason).toContain(`this run is ${CLI_VERSION}`);
  });

  it("accepts a project-local CLI that differs only by patch or preview of the same minor", () => {
    const report = dependencyReport({
      after: pair(
        present("@flowpanel/kit", CLI_VERSION),
        present("@flowpanel/cli", sameMinorPreview),
      ),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report).toMatchObject({ ok: true, failed: [], recovery: [], reason: null });
  });

  it("keeps a package that did resolve out of failed and recovery", () => {
    const report = dependencyReport({
      after: pair(present("@flowpanel/kit", CLI_VERSION), absent("@flowpanel/cli")),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.failed).toEqual(["@flowpanel/cli"]);
    expect(report.recovery).toEqual([`pnpm add -D @flowpanel/cli@~${CLI_VERSION}`]);
    expect(report.installed).toEqual([{ package: "@flowpanel/kit", version: CLI_VERSION }]);
  });

  it("recovers a declared but unresolved package with a plain install", () => {
    const report = dependencyReport({
      after: pair(absent("@flowpanel/kit", "workspace:*"), present("@flowpanel/cli", CLI_VERSION)),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.recovery).toEqual(["pnpm install"]);
  });

  it("carries every problem at once when a package is missing and another is incompatible", () => {
    const report = dependencyReport({
      after: pair(absent("@flowpanel/kit"), present("@flowpanel/cli", otherMinor)),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.failed).toEqual(["@flowpanel/kit", "@flowpanel/cli"]);
    expect(report.recovery).toEqual([
      `pnpm add @flowpanel/kit@~${CLI_VERSION}`,
      `pnpm add -D @flowpanel/cli@~${CLI_VERSION}`,
    ]);
  });

  it("leads with the manager's own failure when the install command failed", () => {
    const report = dependencyReport({
      after: pair(absent("@flowpanel/kit"), absent("@flowpanel/cli")),
      pm: "pnpm",
      pmc,
      installFailure: "ERR_PNPM_FETCH_404",
      kitMismatch: null,
    });
    expect(report.ok).toBe(false);
    expect(report.reason).toBe("ERR_PNPM_FETCH_404");
    expect(report.failed).toEqual(["@flowpanel/kit", "@flowpanel/cli"]);
  });

  it("treats an unreadable installed manifest as unresolved rather than installed", () => {
    const report = dependencyReport({
      after: pair(
        { name: "@flowpanel/kit", declaration: null, installed: null, error: "invalid-manifest" },
        present("@flowpanel/cli", CLI_VERSION),
      ),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.ok).toBe(false);
    expect(report.failed).toEqual(["@flowpanel/kit"]);
  });
});

describe("problems the report must not invent or hide", () => {
  it("stays ok when the manager failed over something else and every package is fine", () => {
    const report = dependencyReport({
      after: pair(present("@flowpanel/kit", CLI_VERSION), present("@flowpanel/cli", CLI_VERSION)),
      pm: "npm",
      pmc: pmCommands("npm"),
      installFailure: "npm error postinstall script failed for some-other-pkg",
      kitMismatch: null,
    });
    expect(report.ok).toBe(true);
    expect(report.failed).toEqual([]);
    expect(report.recovery).toEqual([]);
    expect(report.reason).toBeNull();
    expect(report.warning).toContain("postinstall");
  });

  it("names an unreadable installed manifest instead of calling it unresolved", () => {
    const report = dependencyReport({
      after: pair(
        { name: "@flowpanel/kit", declaration: null, installed: null, error: "invalid-manifest" },
        present("@flowpanel/cli", CLI_VERSION),
      ),
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.reason).toContain("package manifest cannot be read");
    expect(report.warning).toBeNull();
  });

  it("adds a peer-only declaration instead of asking for an install that cannot resolve it", async () => {
    const peerOnly: InspectedDependency = {
      dependency: KIT,
      state: absent("@flowpanel/kit", "^0.1.0", "peerDependencies"),
    };
    const commands: string[][] = [];
    await installMissing({
      cwd: "/project",
      pm: "pnpm",
      pmc,
      missing: [peerOnly],
      inspect: async (_cwd, name) => absent(name),
      run: async (bin, args) => {
        commands.push([bin, ...args]);
        return { code: 0, output: "" };
      },
    });
    expect(commands).toEqual([["pnpm", "add", `@flowpanel/kit@~${CLI_VERSION}`]]);
    const report = dependencyReport({
      after: [peerOnly, { dependency: CLI, state: present("@flowpanel/cli", CLI_VERSION) }],
      pm: "pnpm",
      pmc,
      installFailure: null,
      kitMismatch: null,
    });
    expect(report.recovery).toEqual([`pnpm add @flowpanel/kit@~${CLI_VERSION}`]);
  });
});

describe("inspectRequirements", () => {
  it("keeps requirement order and pairs each with its inspection", async () => {
    const inspected = await inspectRequirements("/project", [KIT, CLI], async (_cwd, name) =>
      name === "@flowpanel/kit" ? present(name, CLI_VERSION) : absent(name),
    );
    expect(inspected.map(({ dependency }) => dependency.pkg)).toEqual([
      "@flowpanel/kit",
      "@flowpanel/cli",
    ]);
    expect(missingDependencies(inspected).map(({ dependency }) => dependency.pkg)).toEqual([
      "@flowpanel/cli",
    ]);
  });
});
