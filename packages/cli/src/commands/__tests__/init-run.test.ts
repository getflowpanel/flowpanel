// LOC-OK: one hermetic end-to-end harness; each scenario runs the real init process.
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_VERSION } from "../../utils/kit";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "../../index.ts");
// The child runs with cwd inside the fixture, so the loader needs an absolute specifier.
const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";

const INSTALLED = {
  next: { version: "16.3.4", engines: { node: ">=20.9.0" } },
  react: { version: "19.2.0" },
  "react-dom": { version: "19.2.0" },
  "drizzle-orm": { version: "0.45.2" },
  typescript: { version: "5.9.3" },
};

let project: string;
let fixtureRoot: string;
let bin: string;

async function writeModule(dir: string, name: string, manifest: Record<string, unknown>) {
  const target = path.join(dir, "node_modules", name);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(
    path.join(target, "package.json"),
    JSON.stringify({ name, ...manifest }, null, 2),
  );
}

const FAKE_NPM = [
  "#!/usr/bin/env node",
  'const fs = require("node:fs");',
  'const path = require("node:path");',
  'const mode = process.env.FP_FAKE ?? "success";',
  'if (mode === "fail") {',
  '  process.stderr.write("npm warn deprecated something" + "\\n");',
  '  process.stderr.write("npm error code E404" + "\\n");',
  '  process.stderr.write("npm error 404 Not Found - GET https://registry.npmjs.org/kit" + "\\n");',
  "  process.exitCode = 1;",
  "  return;",
  "}",
  'if (mode === "secret") {',
  '  process.stderr.write("npm error code E401" + "\\n");',
  '  process.stderr.write("npm error https://user:hunter2@registry.internal/@flowpanel%2fkit" + "\\n");',
  '  process.stderr.write("npm error _authToken=abcd1234 was rejected" + "\\n");',
  "  process.exitCode = 1;",
  "  return;",
  "}",
  'if (mode === "flood") {',
  '  process.stderr.write("x".repeat(200000) + "\\n");',
  '  for (let i = 0; i < 4000; i++) process.stderr.write("npm error line " + i + "\\n");',
  '  process.stderr.write("npm error final cause ETARGET" + "\\n");',
  "  process.exitCode = 1;",
  "  return;",
  "}",
  'if (mode === "unrelated") {',
  '  const target = path.join(process.cwd(), "node_modules", "@flowpanel/kit");',
  "  fs.mkdirSync(target, { recursive: true });",
  '  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "@flowpanel/kit", version: process.env.FP_FAKE_KIT }));',
  '  const cliTarget = path.join(process.cwd(), "node_modules", "@flowpanel/cli");',
  "  fs.mkdirSync(cliTarget, { recursive: true });",
  '  fs.writeFileSync(path.join(cliTarget, "package.json"), JSON.stringify({ name: "@flowpanel/cli", version: process.env.FP_FAKE_CLI }));',
  '  process.stderr.write("npm error code ELIFECYCLE" + "\\n");',
  '  process.stderr.write("npm error postinstall script failed for some-other-pkg" + "\\n");',
  "  process.exitCode = 1;",
  "  return;",
  "}",
  'if (mode === "noop") process.exit(0);',
  "const versions = {",
  '  "@flowpanel/kit": process.env.FP_FAKE_KIT,',
  '  "@flowpanel/cli": process.env.FP_FAKE_CLI,',
  "};",
  "for (const [name, version] of Object.entries(versions)) {",
  "  if (!version) continue;",
  '  const target = path.join(process.cwd(), "node_modules", name);',
  "  fs.mkdirSync(target, { recursive: true });",
  '  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name, version }));',
  "}",
  'const added = process.argv.slice(2).filter((a) => a.includes("@~"));',
  "if (added.length > 0) {",
  '  const manifestPath = path.join(process.cwd(), "package.json");',
  '  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));',
  "  for (const spec of added) {",
  '    const at = spec.lastIndexOf("@");',
  "    const name = spec.slice(0, at);",
  "    const range = spec.slice(at + 1);",
  '    const section = process.argv.includes("--save-dev") || process.argv.includes("-D")',
  '      ? "devDependencies"',
  '      : "dependencies";',
  "    manifest[section] = { ...manifest[section], [name]: range };",
  "  }",
  "  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));",
  "}",
  'fs.appendFileSync(path.join(process.cwd(), "npm-calls.log"), process.argv.slice(2).join(" ") + "\\n");',
  'process.stdout.write("added 2 packages" + "\\n");',
].join("\n");

/**
 * A package manager that installs from the environment instead of the network:
 * FP_FAKE decides whether it succeeds, FP_FAKE_KIT/FP_FAKE_CLI what it leaves
 * behind, so every scenario below is deterministic and offline.
 */
async function fakeNpm(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "npm");
  await fs.writeFile(file, `${FAKE_NPM}\n`);
  await fs.chmod(file, 0o755);
  await fs.writeFile(path.join(dir, "npm.cmd"), `@node "%~dp0npm" %*\r\n`);
}

async function initRun(env: NodeJS.ProcessEnv = {}, args: string[] = ["init", "--json"]) {
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      ["--import", tsxLoader, entry, ...args],
      {
        cwd: project,
        env: {
          ...process.env,
          [pathKey]: `${bin}${path.delimiter}${process.env[pathKey] ?? ""}`,
          NO_COLOR: "1",
          npm_config_user_agent: "",
          ...env,
        },
      },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

async function calls(): Promise<string[]> {
  const log = await fs.readFile(path.join(project, "npm-calls.log"), "utf8").catch(() => "");
  return log.split("\n").filter((line) => line.length > 0);
}

/**
 * Node resolves through every ancestor `node_modules`, so a stray one left in the
 * temp directory would make the fixture see packages it never installed.
 */
async function assertNoAncestorPackages(from: string): Promise<void> {
  for (let dir = path.dirname(from); ; dir = path.dirname(dir)) {
    const stray = path.join(dir, "node_modules", "@flowpanel");
    if (
      await fs.stat(stray).then(
        () => true,
        () => false,
      )
    ) {
      throw new Error(`${stray} would shadow this fixture; remove it before running the suite.`);
    }
    if (path.dirname(dir) === dir) return;
  }
}

beforeEach(async () => {
  project = await fs.mkdtemp(path.join(os.tmpdir(), "fp-init-run-"));
  await assertNoAncestorPackages(project);
  fixtureRoot = project;
  bin = path.join(project, ".bin");
  await fakeNpm(bin);
  await fs.writeFile(
    path.join(project, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        private: true,
        packageManager: "npm@10.9.0",
        dependencies: {
          next: "16.3.4",
          react: "19.2.0",
          "react-dom": "19.2.0",
          "drizzle-orm": "0.45.2",
        },
        devDependencies: { typescript: "5.9.3" },
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(project, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }, null, 2),
  );
  for (const [name, manifest] of Object.entries(INSTALLED)) {
    await writeModule(project, name, manifest);
  }
  await fs.mkdir(path.join(project, "src/app"), { recursive: true });
  await fs.mkdir(path.join(project, "src/server/lib/db"), { recursive: true });
  await fs.writeFile(path.join(project, "src/server/lib/db.ts"), "export const db = {};\n");
  await fs.writeFile(
    path.join(project, "src/server/lib/db/schema.ts"),
    "export const users = {};\n",
  );
});

afterEach(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

describe("init end to end", () => {
  it("succeeds, emits one JSON document, and scaffolds the admin", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({ command: "init", applied: true, dependenciesInstalled: true });
    expect(payload.dependencies.failed).toEqual([]);
    expect(payload.dependencies.recovery).toEqual([]);
    expect(payload.adminPath).toBe("/admin");
    expect(payload.files.applied).toContain("flowpanel.config.ts");
    await expect(
      fs.access(path.join(project, "src/app/admin/[[...slug]]/page.tsx")),
    ).resolves.toBeUndefined();
    expect(
      result.stdout
        .trimEnd()
        .split("\n")
        .filter((line) => line.startsWith("{")),
    ).toHaveLength(1);
  });

  it("stops asking the manager for a package the first command already installed", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    expect(await calls()).toEqual([`install --save @flowpanel/kit@~${CLI_VERSION}`]);
    expect(JSON.parse(result.stdout).dependencies.attempts).toHaveLength(1);
  });

  it("fails with the manager's own reason and a recovery command when nothing installs", async () => {
    const result = await initRun({ FP_FAKE: "fail" });
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.applied).toBe(true);
    expect(payload.dependenciesInstalled).toBe(false);
    expect(payload.dependencies.failed).toEqual(["@flowpanel/kit", "@flowpanel/cli"]);
    expect(payload.dependencies.reason).toContain("404 Not Found");
    expect(payload.dependencies.recovery).toEqual([
      `npm install @flowpanel/kit@~${CLI_VERSION}`,
      `npm install --save-dev @flowpanel/cli@~${CLI_VERSION}`,
    ]);
  });

  it("fails when the manager reports success but installed nothing", async () => {
    const result = await initRun({ FP_FAKE: "noop" });
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.dependencies.reason).toContain("did not resolve");
    expect(payload.dependencies.failed).toEqual(["@flowpanel/kit", "@flowpanel/cli"]);
  });

  it("fails when a package installs with a version this CLI cannot drive", async () => {
    const bumped = `${Number(CLI_VERSION.split(".")[0]) + 1}.0.0`;
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: bumped });
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.dependenciesInstalled).toBe(false);
    expect(payload.dependencies.failed).toEqual(["@flowpanel/cli"]);
    expect(payload.dependencies.recovery).toEqual([
      `npm install --save-dev @flowpanel/cli@~${CLI_VERSION}`,
    ]);
    expect(payload.dependencies.installed).toContainEqual({
      package: "@flowpanel/cli",
      version: bumped,
    });
  });

  it("succeeds when the project CLI differs only by patch within the same minor", async () => {
    const [major, minor] = CLI_VERSION.split(".");
    const result = await initRun({
      FP_FAKE_KIT: CLI_VERSION,
      FP_FAKE_CLI: `${major}.${minor}.99`,
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).dependenciesInstalled).toBe(true);
  });

  it("keeps an existing workspace declaration instead of pinning over it", async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(project, "package.json"), "utf8"));
    manifest.dependencies["@flowpanel/kit"] = "workspace:*";
    manifest.devDependencies["@flowpanel/cli"] = "file:../cli";
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify(manifest, null, 2));
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    expect(await calls()).toEqual(["install"]);
    const after = JSON.parse(await fs.readFile(path.join(project, "package.json"), "utf8"));
    expect(after.dependencies["@flowpanel/kit"]).toBe("workspace:*");
    expect(after.devDependencies["@flowpanel/cli"]).toBe("file:../cli");
  });

  it("never repeats a credential the manager printed", async () => {
    const result = await initRun({ FP_FAKE: "secret" });
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.dependencies.reason).toContain("E401");
    expect(result.stdout).not.toContain("hunter2");
    expect(result.stdout).not.toContain("abcd1234");
    expect(payload.dependencies.reason).toContain("[redacted]");
  });

  it("bounds a flooding installer to its last lines and keeps the cause", async () => {
    const result = await initRun({ FP_FAKE: "flood" });
    expect(result.code).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.dependencies.reason).toContain("ETARGET");
    expect(payload.dependencies.reason.length).toBeLessThan(4_096);
    expect(payload.dependencies.reason.split("\n")).toHaveLength(8);
  });

  it("succeeds when the manager failed over an unrelated package but installed ours", async () => {
    const result = await initRun({
      FP_FAKE: "unrelated",
      FP_FAKE_KIT: CLI_VERSION,
      FP_FAKE_CLI: CLI_VERSION,
    });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.dependenciesInstalled).toBe(true);
    expect(payload.dependencies.failed).toEqual([]);
    expect(payload.dependencies.recovery).toEqual([]);
    expect(payload.dependencies.reason).toBeUndefined();
    expect(payload.dependencies.warning).toContain("postinstall");
  });

  it("still says the manager failed when the run is piped without --json", async () => {
    const result = await initRun(
      { FP_FAKE: "unrelated", FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION },
      ["init", "--yes"],
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("exited with an error while installing something else");
    expect(result.stdout).toContain("postinstall");
  });

  it("sees packages hoisted to a workspace root above the project", async () => {
    // The app declares its dependencies; only the workspace root has node_modules.
    const app = path.join(project, "app");
    const manifest = JSON.parse(await fs.readFile(path.join(project, "package.json"), "utf8"));
    await fs.mkdir(path.join(app, "src/app"), { recursive: true });
    await fs.mkdir(path.join(app, "src/server/lib/db"), { recursive: true });
    await fs.writeFile(path.join(app, "src/server/lib/db.ts"), "export const db = {};\n");
    await fs.writeFile(path.join(app, "src/server/lib/db/schema.ts"), "export const users = {};\n");
    await fs.copyFile(path.join(project, "tsconfig.json"), path.join(app, "tsconfig.json"));
    await fs.writeFile(
      path.join(app, "package.json"),
      JSON.stringify(
        {
          name: "web",
          private: true,
          packageManager: manifest.packageManager,
          dependencies: manifest.dependencies,
          devDependencies: manifest.devDependencies,
        },
        null,
        2,
      ),
    );
    project = app;
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.applied).toBe(true);
    expect(payload.dependencies.failed).toEqual([]);
  });

  it("writes nothing and exits 1 when a prerequisite is unsupported", async () => {
    await writeModule(project, "next", { version: "15.5.0" });
    const result = await initRun();
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ command: "init", applied: false });
    await expect(fs.access(path.join(project, "flowpanel.config.ts"))).rejects.toThrow();
  });

  it("prints a plain-text plan and changes nothing on --dry-run through a pipe", async () => {
    const result = await initRun({}, ["init", "--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("create flowpanel.config.ts");
    await expect(fs.access(path.join(project, "flowpanel.config.ts"))).rejects.toThrow();
    expect(await calls()).toEqual([]);
  });

  it("refuses to prompt when a pipe has no terminal", async () => {
    const result = await initRun({}, ["init"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no interactive terminal");
    await expect(fs.access(path.join(project, "flowpanel.config.ts"))).rejects.toThrow();
  });
});
