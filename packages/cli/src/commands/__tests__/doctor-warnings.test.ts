import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../program";
import { CLI_VERSION } from "../../utils/kit";
import { tpl } from "../../utils/template";
import { type Check, runDoctorChecks } from "../doctor";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

let tmp: string;
let databaseUrl: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-warn-"));
  databaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (databaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = databaseUrl;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(files: Record<string, string>): Promise<void> {
  for (const [file, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(tmp, file)), { recursive: true });
    await fs.writeFile(path.join(tmp, file), contents);
  }
}

const PACKAGE = JSON.stringify({
  dependencies: { next: "16.3.0", "drizzle-orm": "0.45.2" },
  packageManager: "npm@10.9.0",
});

async function checkNamed(name: string): Promise<Check | undefined> {
  const { checks } = await runDoctorChecks(tmp, false);
  return checks.find((check) => check.name === name);
}

describe("doctor — session module warning", () => {
  const CONFIG = 'import { getSession } from "./auth";\nexport default { getSession };\n';

  it("warns when getSession is still the closed stub", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts": await tpl("auth-session.ts.txt"),
    });
    const check = await checkNamed("Session module connected");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toContain("auth.ts is still the closed stub");
    expect(check?.hint).toContain("returns no session");
  });

  it("also recognises the closed stub 0.3 wrote", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts":
        "export async function getSession(_req: Request): Promise<null> {\n  return null;\n}\n",
    });
    expect((await checkNamed("Session module connected"))?.warn).toBe(true);
  });

  it("stays quiet once getSession does something", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts": "export async function getSession() {\n  return readCookie() ?? null;\n}\n",
    });
    const check = await checkNamed("Session module connected");
    expect(check).toEqual({ name: "Session module connected", ok: true });
  });

  it("warns when getSession is the development stub", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts": await tpl("dev-session.ts.txt"),
    });
    const check = await checkNamed("Session module connected");
    expect(check).toEqual({
      name: "Session module connected",
      ok: true,
      warn: true,
      hint: "auth.ts is an open development identity. Replace it before deploying.",
    });
  });

  it("stays quiet for a preset config", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts":
        'import { flowpanelAuth } from "./auth";\nexport default { flowpanelAuth };\n',
      "auth.ts": await tpl("dev-session.ts.txt"),
    });
    expect((await checkNamed("Session module connected"))?.warn).toBeUndefined();
  });

  it("does not exist without a config", async () => {
    await write({ "package.json": PACKAGE });
    expect(await checkNamed("Session module connected")).toBeUndefined();
  });
});

describe("doctor — empty resources warning", () => {
  it("warns when the evaluated config has no resources and names the command", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default { resources: [] };\n",
    });
    const check = await checkNamed("Resources configured");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toContain("npx flowpanel new <table>");
  });

  it("passes with at least one resource", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default { resources: [{ name: 'users' }] };\n",
    });
    expect(await checkNamed("Resources configured")).toEqual({
      name: "Resources configured",
      ok: true,
    });
  });

  it("is skipped when the config cannot be evaluated", async () => {
    await write({ "package.json": PACKAGE, "flowpanel.config.ts": 'throw new Error("boom");\n' });
    expect(await checkNamed("Resources configured")).toBeUndefined();
  });
});

describe("doctor — DATABASE_URL warning", () => {
  it("warns when migrations exist and DATABASE_URL is unset", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel/migrations/0001_init.sql": "select 1;",
    });
    const check = await checkNamed("DATABASE_URL set");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toContain(".env.local");
    expect(check?.hint).toContain("npx flowpanel migrate");
  });

  it("passes when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/app";
    await write({
      "package.json": PACKAGE,
      "flowpanel/migrations/0001_init.sql": "select 1;",
    });
    expect(await checkNamed("DATABASE_URL set")).toEqual({ name: "DATABASE_URL set", ok: true });
  });

  it("is skipped when there are no migrations", async () => {
    await write({ "package.json": PACKAGE });
    expect(await checkNamed("DATABASE_URL set")).toBeUndefined();
  });
});

describe("doctor — kit installed check", () => {
  it("fails and says how to install when the kit is not installed", async () => {
    await write({ "package.json": PACKAGE });
    const check = await checkNamed("@flowpanel/kit matches this CLI");
    expect(check?.ok).toBe(false);
    expect(check?.hint).toContain("not installed");
    expect(check?.hint).toContain(`npm install @flowpanel/kit@~${CLI_VERSION}`);
  });
});

const require = createRequire(import.meta.url);

const FAKE_NEXT = [
  'const fs = require("node:fs");',
  'const routes = fs.existsSync("app/api/flowpanel/stream/route.ts");',
  'fs.appendFileSync("typegen.log", process.argv.slice(2).join(" ") + " routes=" + routes + "\\n");',
  'if (process.argv[2] === "typegen") {',
  '  fs.mkdirSync(".next/types", { recursive: true });',
  '  fs.writeFileSync(".next/types/globals.d.ts", "declare const NEXT_GLOBAL: number;\\n");',
  "}",
].join("\n");

const FAKE_KIT_TYPES = [
  "export declare function createFlowpanel(config: unknown): {",
  "  page: unknown; metadata: unknown; notFound: unknown;",
  "  handlers: { GET: unknown; POST: unknown; PUT: unknown; PATCH: unknown; DELETE: unknown; OPTIONS: unknown };",
  "};",
  "export declare function stream(config: unknown): (request: Request) => Response;",
  "",
].join("\n");

/** A project whose installed packages satisfy every prerequisite check; only the generated files are missing. */
async function installedProject(extra: Record<string, string> = {}): Promise<void> {
  const typescript = path.dirname(require.resolve("typescript/package.json"));
  await fs.mkdir(path.join(tmp, "node_modules"), { recursive: true });
  await fs.symlink(typescript, path.join(tmp, "node_modules/typescript"), "junction");
  const stub = (name: string, version: string, more: Record<string, unknown> = {}) => ({
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, version, ...more }),
  });
  await write({
    "package.json": JSON.stringify({
      dependencies: {
        next: "16.3.0",
        react: "19.2.0",
        "react-dom": "19.2.0",
        "drizzle-orm": "0.45.2",
      },
      devDependencies: { typescript: "5.9.3" },
      packageManager: "npm@10.9.0",
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        moduleResolution: "bundler",
        module: "esnext",
        target: "es2022",
        skipLibCheck: true,
        types: [],
      },
      include: ["src/**/*.ts", "app/**/*.ts", ".next/types/**/*.ts", "flowpanel.config.ts"],
    }),
    "flowpanel.config.ts": "export default { resources: [{ name: 'users' }] };\n",
    ...stub("next", "16.3.0", { bin: { next: "bin/next.js" } }),
    "node_modules/next/bin/next.js": FAKE_NEXT,
    ...stub("react", "19.2.0"),
    ...stub("react-dom", "19.2.0"),
    ...stub("drizzle-orm", "0.45.2"),
    ...stub("@flowpanel/kit", CLI_VERSION, { exports: { "./next": { types: "./next.d.ts" } } }),
    "node_modules/@flowpanel/kit/next.d.ts": FAKE_KIT_TYPES,
    "src/uses-global.ts": "export const value: number = NEXT_GLOBAL;\n",
    ...extra,
  });
}

describe("doctor output", () => {
  const out: string[] = [];
  const err: string[] = [];

  beforeEach(() => {
    out.length = 0;
    err.length = 0;
    vi.spyOn(process, "cwd").mockReturnValue(tmp);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit ${code}`);
    });
  });

  async function doctor(...args: string[]): Promise<void> {
    await expect(
      createProgram().parseAsync(["node", "flowpanel", "doctor", ...args]),
    ).rejects.toThrow(/exit/);
  }

  it("marks a warning with ! and ends on the count instead of claiming everything passed", async () => {
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/app";
    await installedProject({ "flowpanel.config.ts": "export default { resources: [] };\n" });
    await runDoctorChecks(tmp, true, { quiet: true });
    out.length = 0;
    await doctor();
    const text = out.join("");
    expect(text).toMatch(/! Resources configured\n {4}resources is empty\./);
    expect(text).toContain("! No failures, 1 warning to review.");
    expect(text).not.toContain("All checks passed.");
    expect(err.join("")).toBe("");
  });

  it("still says all checks passed when nothing warns", async () => {
    await installedProject();
    await runDoctorChecks(tmp, true, { quiet: true });
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/app";
    out.length = 0;
    await doctor();
    expect(out.join("")).toContain("✓ All checks passed.");
  });

  it("prints hints only on failing checks and warnings in JSON, and flags a warning", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default { resources: [] };\n",
    });
    await doctor("--json");
    const { checks } = JSON.parse(out.join("")) as { checks: Array<Record<string, unknown>> };
    const named = (name: string) => checks.find((check) => check.name === name);
    expect(named("Resources configured")).toMatchObject({ ok: true, warn: true });
    expect(named("Resources configured")?.hint).toEqual(expect.any(String));
    expect(named("flowpanel.config.ts")).toEqual({ name: "flowpanel.config.ts", ok: true });
    expect(named("Node.js supported")).toEqual({ name: "Node.js supported", ok: true });
    const failing = checks.find((check) => check.ok === false);
    expect(failing?.hint).toEqual(expect.any(String));
    for (const check of checks) {
      if (check.ok === true && check.warn !== true) expect(check).not.toHaveProperty("hint");
    }
  });

  it("says where it ran when the directory is not a Next.js project", async () => {
    await doctor();
    expect(err.join("")).toContain(
      `No Next.js project found in ${tmp}. Run this from your project root.`,
    );
  });

  it("puts the same message in the JSON document", async () => {
    await doctor("--json");
    expect(JSON.parse(out.join(""))).toEqual({
      command: "doctor",
      ok: false,
      error: `No Next.js project found in ${tmp}. Run this from your project root.`,
    });
  });
});

describe("doctor — tsc check", () => {
  it("runs next typegen first when .next/types is missing", async () => {
    await installedProject();
    const { checks } = await runDoctorChecks(tmp, false);
    expect(checks.find((check) => check.name === "tsc --noEmit")?.ok).toBe(true);
    expect(await fs.readFile(path.join(tmp, "typegen.log"), "utf8")).toBe("typegen routes=false\n");
  });

  it("does not run it when .next/types exists", async () => {
    await installedProject({ ".next/types/globals.d.ts": "declare const NEXT_GLOBAL: number;\n" });
    const { checks } = await runDoctorChecks(tmp, false);
    expect(checks.find((check) => check.name === "tsc --noEmit")?.ok).toBe(true);
    await expect(fs.access(path.join(tmp, "typegen.log"))).rejects.toThrow();
  });

  it("does not run typegen for a Next that has no such command", async () => {
    await installedProject({
      "node_modules/next/package.json": JSON.stringify({
        name: "next",
        version: "15.4.0",
        bin: { next: "bin/next.js" },
      }),
    });
    await runDoctorChecks(tmp, false);
    await expect(fs.access(path.join(tmp, "typegen.log"))).rejects.toThrow();
  });

  it("with --fix, generates types and compiles once, after the route files exist", async () => {
    await installedProject();
    await fs.rm(path.join(tmp, "node_modules/typescript"));
    await write({
      "node_modules/typescript/package.json": JSON.stringify({
        name: "typescript",
        version: "5.9.3",
        bin: { tsc: "bin/tsc.js" },
      }),
      "node_modules/typescript/bin/tsc.js":
        'require("node:fs").appendFileSync("tsc.log", process.argv.slice(2).join(" ") + "\\n");\n',
    });
    await runDoctorChecks(tmp, true, { quiet: true });
    expect(await fs.readFile(path.join(tmp, "typegen.log"), "utf8")).toBe("typegen routes=true\n");
    expect(await fs.readFile(path.join(tmp, "tsc.log"), "utf8")).toBe("--noEmit\n");
  });

  it("checks again after --fix, so one run ends green", async () => {
    await installedProject({
      "src/uses-route.ts":
        'import { GET } from "../app/api/flowpanel/stream/route";\nexport { GET };\n',
    });
    const before = await runDoctorChecks(tmp, false, { quiet: true });
    expect(before.checks.find((check) => check.name === "tsc --noEmit")?.ok).toBe(false);

    const after = await runDoctorChecks(tmp, true, { quiet: true });
    expect(after.checks.find((check) => check.name === "SSE route")?.ok).toBe(true);
    expect(after.checks.find((check) => check.name === "tsc --noEmit")?.ok).toBe(true);
    expect(after.bad).toBe(0);
  });
});
