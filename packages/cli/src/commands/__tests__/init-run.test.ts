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
  '  const manifestPath = path.join(process.cwd(), "package.json");',
  '  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));',
  '  manifest.dependencies = { ...manifest.dependencies, "@flowpanel/kit": "~" + process.env.FP_FAKE_KIT };',
  '  manifest.devDependencies = { ...manifest.devDependencies, "@flowpanel/cli": "~" + process.env.FP_FAKE_CLI };',
  "  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));",
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
          pg: "8.13.0",
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

  it("adds a package the first command installed but left out of package.json", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    expect(await calls()).toEqual([
      `install --save @flowpanel/kit@~${CLI_VERSION}`,
      `install --save-dev @flowpanel/cli@~${CLI_VERSION}`,
    ]);
    expect(JSON.parse(result.stdout).dependencies.attempts).toHaveLength(2);
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

  it("writes a config that registers the session and maps the role without a cast", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, [
      "init",
      "--yes",
      "--json",
    ]);
    expect(result.code).toBe(0);
    const config = await fs.readFile(path.join(project, "flowpanel.config.ts"), "utf8");
    expect(config).toContain("session: NonNullable<Awaited<ReturnType<typeof getSession>>>;");
    expect(config).toContain('role: (s) => s?.user.role ?? "guest"');
    expect(config).toContain("// npx flowpanel new <table>  adds an entry;");
    expect(config).not.toContain("adminUserRow");
    const stub = await fs.readFile(path.join(project, "src/server/lib/auth.ts"), "utf8");
    expect(stub).toContain("Promise<Session | null>");
  });

  it("hands a recognised provider's preset to auth", async () => {
    await writeModule(project, "better-auth", { version: "1.3.0" });
    const manifest = JSON.parse(await fs.readFile(path.join(project, "package.json"), "utf8"));
    manifest.dependencies["better-auth"] = "1.3.0";
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(project, "src/server/lib/auth.ts"), "export const auth = {};\n");
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).authentication).toBe("preset:better-auth");
    const config = await fs.readFile(path.join(project, "flowpanel.config.ts"), "utf8");
    expect(config).toContain('import { flowpanelAuth } from "@/server/lib/flowpanel-session";');
    expect(config).toContain("auth: flowpanelAuth,");
    expect(config).not.toContain("getSession");
  });

  it("scaffolds the not-found page beside the admin layout", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    const payload = JSON.parse(result.stdout);
    expect(payload.files.applied).toContain("src/app/admin/not-found.tsx");
    expect(payload.plan.operations).toContainEqual({
      kind: "create",
      path: "src/app/admin/not-found.tsx",
    });
    const notFound = await fs.readFile(path.join(project, "src/app/admin/not-found.tsx"), "utf8");
    expect(notFound).toContain(
      'import config from "@/../flowpanel.config";'.replace("@/../", "../../../"),
    );
    expect(notFound).toContain("export default flowpanel.notFound;");
    const page = await fs.readFile(
      path.join(project, "src/app/admin/[[...slug]]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("export const generateMetadata = flowpanel.metadata;");
  });

  it("brings an admin page written before generateMetadata up to date", async () => {
    const dir = path.join(project, "src/app/admin/[[...slug]]");
    await fs.mkdir(dir, { recursive: true });
    const previous = [
      'import { createFlowpanel } from "@flowpanel/kit/next";',
      'import config from "../../../../flowpanel.config";',
      "",
      "const flowpanel = createFlowpanel(config);",
      "",
      "export default flowpanel.page;",
      "",
    ].join("\n");
    await fs.writeFile(path.join(dir, "page.tsx"), previous);
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.adminPath).toBe("/admin");
    expect(payload.plan.operations).toContainEqual({
      kind: "modify",
      path: "src/app/admin/[[...slug]]/page.tsx",
    });
    expect(await fs.readFile(path.join(dir, "page.tsx"), "utf8")).toContain("generateMetadata");
  });

  it("prints what it wrote, what it installed and where to go next when piped", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, [
      "init",
      "--yes",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout.startsWith("Wrote\n  flowpanel.config.ts\n")).toBe(true);
    for (const file of [
      "src/app/admin/[[...slug]]/page.tsx",
      "src/app/admin/not-found.tsx",
      "src/server/lib/auth.ts",
    ]) {
      expect(result.stdout).toContain(`\n  ${file}\n`);
    }
    expect(result.stdout).toContain(`Installed @flowpanel/kit@~${CLI_VERSION}`);
    expect(result.stdout).toContain(
      [
        "! src/server/lib/auth.ts returns no session, so the admin denies every request. Return your provider's session from getSession there, or run npx flowpanel init --dev-auth for an open development identity.",
        "",
        "Next",
        "  npx flowpanel new <table>    add a resource to flowpanel.config.ts",
        "  npm run dev                  start Next.js and open the admin URL below",
        "  npx flowpanel migrate        only if you turn on the audit log: creates flowpanel_audit_log",
        "  https://flowpanel.tech/docs/introduction/getting-started",
        "",
        "Admin: http://localhost:3000/admin",
        "",
      ].join("\n"),
    );
  });

  it("marks an incomplete init with a warning line when piped", async () => {
    const result = await initRun({ FP_FAKE: "fail" }, ["init", "--yes"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("! FlowPanel init is incomplete\n\nTo finish\n");
  });

  it("says the development identity is open when --dev-auth is given", async () => {
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, [
      "init",
      "--yes",
      "--dev-auth",
    ]);
    expect(result.stdout).toContain(
      "! src/server/lib/auth.ts signs every request in as an admin in development and throws under `next start`. Replace it with your auth provider before deploying.\n\nNext\n",
    );
    expect(result.stdout).not.toContain("returns no session");
  });

  describe("--dev-auth on an initialized project", () => {
    const installed = { FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION };
    const CUSTOMISED = "export async function getSession() {\n  return readCookie() ?? null;\n}\n";
    const sessionFile = () => path.join(project, "src/server/lib/auth.ts");
    const ownModule =
      'Nothing was written. src/server/lib/auth.ts is your own session module, so --dev-auth leaves it alone. To open the admin while you develop, return a session from getSession there, or put auth: devAuth() in flowpanel.config.ts (import { devAuth } from "@flowpanel/kit").';
    const exportsGetSession =
      'Nothing was written. src/server/lib/auth.ts already exports getSession, so --dev-auth leaves it alone. Run init without --dev-auth to use it; to open the admin while you develop, then put auth: devAuth() in flowpanel.config.ts (import { devAuth } from "@flowpanel/kit").';

    it("replaces the untouched closed stub and says so", async () => {
      await initRun(installed, ["init", "--yes"]);
      const closed = await fs.readFile(sessionFile(), "utf8");
      const result = await initRun(installed, ["init", "--yes", "--dev-auth"]);
      expect(result.code).toBe(0);
      expect(result.stdout).toBe(
        "Wrote\n  src/server/lib/auth.ts\n\n! src/server/lib/auth.ts signs every request in as an admin in development and throws under `next start`. Replace it with your auth provider before deploying.\n\nAdmin: http://localhost:3000/admin\n",
      );
      const written = await fs.readFile(sessionFile(), "utf8");
      expect(written).not.toBe(closed);
      expect(written).toContain("DEVELOPMENT STUB");
    });

    it("plans the replacement as a modify and reports it in --json", async () => {
      await initRun(installed, ["init", "--yes"]);
      const result = await initRun(installed, ["init", "--json", "--dev-auth"]);
      const payload = JSON.parse(result.stdout);
      expect(payload.authentication).toBe("development");
      expect(payload.files.applied).toEqual(["src/server/lib/auth.ts"]);
      expect(payload.plan.operations).toContainEqual({
        kind: "modify",
        path: "src/server/lib/auth.ts",
      });
    });

    it("reports the development stub as unchanged on a second run", async () => {
      await initRun(installed, ["init", "--yes", "--dev-auth"]);
      const result = await initRun(installed, ["init", "--json", "--dev-auth"]);
      const payload = JSON.parse(result.stdout);
      expect(result.code).toBe(0);
      expect(payload.applied).toBe(false);
      expect(payload.files.applied).toEqual([]);
      expect(payload.plan.operations).toContainEqual({
        kind: "skip",
        path: "src/server/lib/auth.ts",
        reason: "unchanged",
      });
      expect(payload.authentication).toBe("development");
    });

    it("leaves a customised session module alone and exits 1", async () => {
      await initRun(installed, ["init", "--yes"]);
      await fs.writeFile(sessionFile(), CUSTOMISED);
      const result = await initRun(installed, ["init", "--yes", "--dev-auth"]);
      expect(result.code).toBe(1);
      expect(result.stderr).toBe(`✗ ${ownModule}\n`);
      expect(result.stdout).toBe("");
      expect(await fs.readFile(sessionFile(), "utf8")).toBe(CUSTOMISED);
    });

    it("leaves a module that exports more than the closed stub alone", async () => {
      await initRun(installed, ["init", "--yes"]);
      const own = [
        'export const auth = betterAuth({ database: "x" });',
        "type Session = { user: { id: string; role: string } };",
        "export async function getSession(): Promise<Session | null> {",
        "  return null;",
        "}",
        "",
      ].join("\n");
      await fs.writeFile(sessionFile(), own);
      const result = await initRun(installed, ["init", "--yes", "--dev-auth"]);
      expect(result.code).toBe(1);
      expect(result.stderr).toBe(`✗ ${ownModule}\n`);
      expect(await fs.readFile(sessionFile(), "utf8")).toBe(own);
    });

    it("refuses a customised module that predates the config, and writes nothing", async () => {
      await fs.writeFile(sessionFile(), CUSTOMISED);
      const result = await initRun(installed, ["init", "--yes", "--dev-auth"]);
      expect(result.code).toBe(1);
      expect(result.stderr).toBe(`✗ ${exportsGetSession}\n`);
      expect(await fs.readFile(sessionFile(), "utf8")).toBe(CUSTOMISED);
      await expect(fs.access(path.join(project, "flowpanel.config.ts"))).rejects.toThrow();
    });

    it("puts the refusal in the --json error payload", async () => {
      await fs.writeFile(sessionFile(), CUSTOMISED);
      const result = await initRun(installed, ["init", "--json", "--dev-auth"]);
      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        command: "init",
        applied: false,
        error: exportsGetSession,
      });
    });

    it("works after new and other edits changed flowpanel.config.ts", async () => {
      await initRun(installed, ["init", "--yes"]);
      const config = path.join(project, "flowpanel.config.ts");
      const edited = (await fs.readFile(config, "utf8")).replace(
        "resources: [",
        "resources: [\n    resource(schema.users, {}),",
      );
      await fs.writeFile(config, edited);
      await fs.writeFile(path.join(project, "src/app/admin/layout.tsx"), "// customised\n");
      const result = await initRun(installed, ["init", "--yes", "--dev-auth"]);
      expect(result.code).toBe(0);
      expect(await fs.readFile(sessionFile(), "utf8")).toContain("DEVELOPMENT STUB");
      expect(await fs.readFile(config, "utf8")).toBe(edited);
    });

    it("keeps the closed stub without the flag", async () => {
      await initRun(installed, ["init", "--yes"]);
      const closed = await fs.readFile(sessionFile(), "utf8");
      const result = await initRun(installed, ["init", "--json"]);
      expect(result.code).toBe(0);
      expect(await fs.readFile(sessionFile(), "utf8")).toBe(closed);
    });
  });

  it("says nothing changed on a second run and still names the closed stub", async () => {
    const installed = { FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION };
    await initRun(installed, ["init", "--yes"]);
    const result = await initRun(installed, ["init", "--yes"]);
    expect(result.code).toBe(0);
    expect(result.stdout.startsWith("✓ Already set up; nothing changed.\n")).toBe(true);
    expect(result.stdout).toContain("! src/server/lib/auth.ts returns no session");
  });

  it("keeps a flowpanel.config.tsx and writes no second config beside it", async () => {
    const installed = { FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION };
    await initRun(installed, ["init", "--yes"]);
    const ts = path.join(project, "flowpanel.config.ts");
    const tsx = path.join(project, "flowpanel.config.tsx");
    await fs.rename(ts, tsx);
    const before = await fs.readFile(tsx, "utf8");
    const result = await initRun(installed, ["init", "--yes"]);
    expect(result.code).toBe(0);
    expect(result.stdout.startsWith("✓ Already set up; nothing changed.\n")).toBe(true);
    await expect(fs.access(ts)).rejects.toThrow();
    expect(await fs.readFile(tsx, "utf8")).toBe(before);
  });

  it("shows starting files for the modules it cannot find, instead of a bare path error", async () => {
    await fs.rm(path.join(project, "src/server/lib/db.ts"));
    await fs.rm(path.join(project, "src/server/lib/db/schema.ts"));
    const result = await initRun({}, ["init", "--yes"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "FlowPanel reads the database through your Drizzle client and Drizzle schema, and init found none.",
    );
    expect(result.stderr).toContain("  src/server/lib/db.ts\n");
    expect(result.stderr).toContain("  src/server/lib/db/schema.ts\n");
    await expect(fs.access(path.join(project, "flowpanel.config.ts"))).rejects.toThrow();
  });

  it("prints the mount fallback as a warning line when piped", async () => {
    await fs.mkdir(path.join(project, "src/app/(dashboard)/admin"), { recursive: true });
    await fs.writeFile(
      path.join(project, "src/app/(dashboard)/admin/page.tsx"),
      "export default function Page() { return null; }\n",
    );
    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, [
      "init",
      "--yes",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      "! /admin is occupied by src/app/(dashboard)/admin/page.tsx; using /flowpanel.\n",
    );
    expect(result.stdout).toContain("Admin: http://localhost:3000/flowpanel");
  });

  it("lists every conflicting path when piped and changes nothing", async () => {
    const own = 'export default { paths: { admin: "/admin", api: "/api/flowpanel" } };\n';
    await fs.writeFile(path.join(project, "flowpanel.config.ts"), own);
    await fs.mkdir(path.join(project, "src/app/admin"), { recursive: true });
    await fs.writeFile(path.join(project, "src/app/admin/layout.tsx"), "// mine too\n");
    await fs.writeFile(path.join(project, "src/app/admin/not-found.tsx"), "// mine\n");
    const result = await initRun({}, ["init", "--yes"]);
    expect(result.code).toBe(1);
    expect(result.stderr).not.toContain("  flowpanel.config.ts\n");
    expect(result.stderr).toContain("  src/app/admin/layout.tsx\n");
    expect(result.stderr).toContain("  src/app/admin/not-found.tsx\n");
    expect(result.stderr.trimEnd().split("\n").at(-1)).toBe(
      "FlowPanel does not overwrite files it did not write.",
    );
    expect(await fs.readFile(path.join(project, "flowpanel.config.ts"), "utf8")).toBe(own);
    await expect(fs.access(path.join(project, "src/app/api"))).rejects.toThrow();
  });

  it("names the directory when it is not a Next.js project", async () => {
    project = path.join(fixtureRoot, "empty");
    await fs.mkdir(project);
    const result = await initRun({}, ["init", "--yes"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`No Next.js project found in ${await fs.realpath(project)}.`);
    expect(result.stderr).toContain("Run this from your project root.");
  });

  it("prints no escape sequences when piped under CI without NO_COLOR", async () => {
    await fs.mkdir(path.join(project, "src/app/(dashboard)/admin"), { recursive: true });
    await fs.writeFile(
      path.join(project, "src/app/(dashboard)/admin/page.tsx"),
      "export default function Page() { return null; }\n",
    );
    await fs.writeFile(path.join(project, "src/app/layout.tsx"), "export default 1 +;\n");
    const env = { CI: "1", NO_COLOR: undefined, FORCE_COLOR: undefined };
    const scenarios: Array<[NodeJS.ProcessEnv, string[]]> = [
      [{ ...env, FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, ["init", "--yes"]],
      [{ ...env, FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, ["init", "--dry-run"]],
      [{ ...env, FP_FAKE: "fail" }, ["init", "--yes"]],
    ];
    for (const [scenario, args] of scenarios) {
      const result = await initRun(scenario, args);
      expect(result.stdout.length).toBeGreaterThan(0);
      expect(result.stdout).not.toContain("\u001b[");
      expect(result.stderr).not.toContain("\u001b[");
      await fs.rm(path.join(project, "flowpanel.config.ts"), { force: true });
    }
  });

  it("writes nothing and exits 1 when a prerequisite is unsupported", async () => {
    await writeModule(project, "next", { version: "15.4.8" });
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

  it("adds suppressHydrationWarning to a create-next-app-shaped root layout", async () => {
    const createNextAppLayout = [
      'import type { Metadata } from "next";',
      "",
      'export const metadata: Metadata = { title: "Create Next App" };',
      "",
      "export default function RootLayout({ children }: { children: React.ReactNode }) {",
      "  return (",
      '    <html lang="en">',
      "      <body>{children}</body>",
      "    </html>",
      "  );",
      "}",
      "",
    ].join("\n");
    await fs.writeFile(path.join(project, "src/app/layout.tsx"), createNextAppLayout);

    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.files.applied).toContain("src/app/layout.tsx");
    expect(payload.plan.operations).toContainEqual(
      expect.objectContaining({ kind: "modify", path: "src/app/layout.tsx" }),
    );

    const patched = await fs.readFile(path.join(project, "src/app/layout.tsx"), "utf8");
    expect(patched).toContain('<html lang="en" suppressHydrationWarning>');

    // The nested admin layout renders ThemeScript; the root layout stays the host's.
    const adminLayout = await fs.readFile(path.join(project, "src/app/admin/layout.tsx"), "utf8");
    expect(adminLayout).toContain("ThemeScript");
    expect(adminLayout).not.toContain("<html");
  });

  it("suggests the tabs shell when the root layout renders a header", async () => {
    const withHeader = [
      "export default function RootLayout({ children }: { children: React.ReactNode }) {",
      "  return (",
      '    <html lang="en">',
      "      <body>",
      '        <header className="h-14">Acme</header>',
      "        {children}",
      "      </body>",
      "    </html>",
      "  );",
      "}",
      "",
    ].join("\n");
    await fs.writeFile(path.join(project, "src/app/layout.tsx"), withHeader);

    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).warnings).toContainEqual(
      expect.stringContaining('Set shell: "tabs" in flowpanel.config.ts'),
    );
  });

  it("leaves an already-patched root layout alone and reports it unchanged", async () => {
    const alreadyPatched = [
      "export default function RootLayout({ children }: { children: React.ReactNode }) {",
      '  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;',
      "}",
      "",
    ].join("\n");
    await fs.writeFile(path.join(project, "src/app/layout.tsx"), alreadyPatched);

    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION });
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.files.applied).not.toContain("src/app/layout.tsx");
    expect(payload.warnings).toEqual([]);
    const unchanged = await fs.readFile(path.join(project, "src/app/layout.tsx"), "utf8");
    expect(unchanged).toBe(alreadyPatched);
  });

  it("tells the developer to add the attribute by hand when the layout cannot be parsed", async () => {
    await fs.writeFile(path.join(project, "src/app/layout.tsx"), "export default 1 +;\n");

    const result = await initRun({ FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION }, [
      "init",
      "--yes",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Could not add suppressHydrationWarning");
    expect(result.stdout).toContain("src/app/layout.tsx");
  });
});

describe("init on a Prisma host", () => {
  async function usePrisma(schema?: string): Promise<void> {
    const manifest = JSON.parse(await fs.readFile(path.join(project, "package.json"), "utf8"));
    delete manifest.dependencies["drizzle-orm"];
    manifest.dependencies["@prisma/client"] = "5.22.0";
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify(manifest, null, 2));
    await fs.rm(path.join(project, "node_modules/drizzle-orm"), { recursive: true });
    await writeModule(project, "@prisma/client", { version: "5.22.0" });
    await fs.rm(path.join(project, "src/server"), { recursive: true });
    await fs.mkdir(path.join(project, "src/lib"), { recursive: true });
    await fs.writeFile(path.join(project, "src/lib/prisma.ts"), "export const prisma = {};\n");
    if (schema !== undefined) {
      await fs.mkdir(path.join(project, "prisma"), { recursive: true });
      await fs.writeFile(path.join(project, "prisma/schema.prisma"), schema);
    }
  }

  const installed = { FP_FAKE_KIT: CLI_VERSION, FP_FAKE_CLI: CLI_VERSION };

  it("writes the provider of the real datasource, not a commented one", async () => {
    await usePrisma(
      'datasource db {\n  // provider = "sqlite"\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}\n',
    );
    const result = await initRun(installed);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).warnings).toEqual([]);
    const config = await fs.readFile(path.join(project, "flowpanel.config.ts"), "utf8");
    expect(config).toContain('adapter: prismaAdapter({ prisma, provider: "mysql" }),');
  });

  it("refuses a provider the adapter does not support and writes nothing", async () => {
    await usePrisma('datasource db {\n  provider = "mongodb"\n  url = env("DATABASE_URL")\n}\n');
    const result = await initRun(installed, ["init", "--yes"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "prismaAdapter supports postgresql, mysql and sqlite; your Prisma schema uses mongodb.",
    );
    await expect(fs.access(path.join(project, "flowpanel.config.ts"))).rejects.toThrow();
  });

  it("falls back to postgresql with a warning when it finds no datasource", async () => {
    await usePrisma("model User {\n  id Int @id\n}\n");
    const json = JSON.parse((await initRun(installed)).stdout);
    expect(json.warnings).toEqual([expect.stringContaining('wrote provider: "postgresql"')]);
    const config = await fs.readFile(path.join(project, "flowpanel.config.ts"), "utf8");
    expect(config).toContain('provider: "postgresql"');
  });

  it("prints that warning as a line when piped, and names a model in the next steps", async () => {
    await usePrisma();
    const result = await initRun(installed, ["init", "--yes"]);
    expect(result.stdout).toContain(
      '! Could not read the datasource provider from your Prisma schema; wrote provider: "postgresql"',
    );
    expect(result.stdout).toContain("npx flowpanel new <model>");
  });
});
