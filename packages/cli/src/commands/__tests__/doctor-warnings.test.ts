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
    const check = await checkNamed("Session module");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toContain("auth.ts is still the closed stub");
    expect(check?.hint).toContain("denies every request");
    expect(check?.hint).toContain("init --dev-auth");
  });

  it("also recognises the closed stub 0.3 wrote", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts":
        "export async function getSession(_req: Request): Promise<null> {\n  return null;\n}\n",
    });
    expect((await checkNamed("Session module"))?.warn).toBe(true);
  });

  it("treats a development stub that exports more as the developer's module", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts": `${await tpl("dev-session.ts.txt", { FILE: "auth.ts" })}\nexport const auth = {};\n`,
    });
    const check = await checkNamed("Session module");
    expect(check).toEqual({ name: "Session module", ok: true });
  });

  it("stays quiet once getSession does something", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts": "export async function getSession() {\n  return readCookie() ?? null;\n}\n",
    });
    const check = await checkNamed("Session module");
    expect(check).toEqual({ name: "Session module", ok: true });
  });

  it("warns when getSession is the development stub", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": CONFIG,
      "auth.ts": await tpl("dev-session.ts.txt", { FILE: "auth.ts" }),
    });
    const check = await checkNamed("Session module");
    expect(check).toEqual({
      name: "Session module",
      ok: true,
      warn: true,
      hint: "auth.ts signs every request in as an admin in development and throws under `next start`. Replace it with your auth provider before deploying.",
    });
  });

  it("stays quiet for a preset config", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts":
        'import { flowpanelAuth } from "./auth";\nexport default { flowpanelAuth };\n',
      "auth.ts": await tpl("dev-session.ts.txt", { FILE: "auth.ts" }),
    });
    expect((await checkNamed("Session module"))?.warn).toBeUndefined();
  });

  it("does not exist without a config", async () => {
    await write({ "package.json": PACKAGE });
    expect(await checkNamed("Session module")).toBeUndefined();
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

  it("is skipped when the config cannot be evaluated, which is a failure of its own", async () => {
    await write({ "package.json": PACKAGE, "flowpanel.config.ts": 'throw new Error("boom");\n' });
    expect(await checkNamed("Resources configured")).toBeUndefined();
    expect(await checkNamed("flowpanel.config.ts evaluates")).toEqual({
      name: "flowpanel.config.ts evaluates",
      ok: false,
      hint: "boom",
    });
  });

  it("evaluates a flowpanel.config.tsx instead of passing without reading it", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.tsx": 'throw new Error("tsx boom");\n',
    });
    expect(await checkNamed("flowpanel.config.tsx")).toMatchObject({ ok: true });
    expect(await checkNamed("flowpanel.config.tsx evaluates")).toEqual({
      name: "flowpanel.config.tsx evaluates",
      ok: false,
      hint: "tsx boom",
    });
  });

  it("reads the resources of a flowpanel.config.tsx", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.tsx": "export default { resources: [] };\n",
    });
    expect(await checkNamed("Resources configured")).toMatchObject({ ok: true, warn: true });
  });
});

describe("doctor before init", () => {
  it("asks for init once instead of a --fix that refuses", async () => {
    await write({ "package.json": PACKAGE });
    const { checks } = await runDoctorChecks(tmp, false, { quiet: true });
    const failing = checks.filter((check) => !check.ok);
    expect(failing.map((check) => check.hint).join("\n")).not.toContain("--fix");
    expect(checks.find((check) => check.name === "flowpanel.config.ts")).toEqual({
      name: "flowpanel.config.ts",
      ok: false,
      hint: "Not set up yet. Run: npx @flowpanel/cli init",
    });
    expect(checks.map((check) => check.name)).not.toContain("API route");
  });
});

describe("doctor — DATABASE_URL warning", () => {
  it("warns when migrations exist and DATABASE_URL is unset", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default {};\n",
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
      "flowpanel.config.ts": "export default {};\n",
      "flowpanel/migrations/0001_init.sql": "select 1;",
    });
    expect(await checkNamed("DATABASE_URL set")).toEqual({ name: "DATABASE_URL set", ok: true });
  });

  it("is skipped when there are no migrations", async () => {
    await write({ "package.json": PACKAGE, "flowpanel.config.ts": "export default {};\n" });
    expect(await checkNamed("DATABASE_URL set")).toBeUndefined();
  });
});

describe("doctor — resource tables", () => {
  it("warns when the database has no table for a resource", async () => {
    process.env.DATABASE_URL = "postgres://probe.invalid/app";
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": `export default {
        resources: [{}],
        adapter: { count: async () => { throw new Error('relation "users" does not exist'); } },
        resourcesByName: new Map([["users", { ref: "users" }]]),
      };\n`,
    });
    const check = await checkNamed("Resource tables");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toContain("users has no table in the database DATABASE_URL points at");
  });
});

describe("doctor — audit log table", () => {
  const INIT_0_3 =
    "CREATE TABLE IF NOT EXISTS flowpanel_audit_log (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  action text NOT NULL\n);\n";

  it("warns beside a 0.3 0001 and fixes it by writing the 0002", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default {};\n",
      "flowpanel/migrations/0001_init.sql": INIT_0_3,
    });
    const check = await checkNamed("Audit log table");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toContain("is from 0.3");
    expect(check?.hint).toContain("npx flowpanel migrate");
    expect((await check?.fix?.())?.path).toBe("flowpanel/migrations/0002_audit_log_0_4.sql");
  });

  it("offers the 0002 when the table lacks the columns and the 0001 is already 0.4's", async () => {
    process.env.DATABASE_URL = "postgres://probe.invalid/app";
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": `export default {
        auditLog: { list: async () => { throw new Error('column "scope_key" does not exist'); } },
      };\n`,
      "flowpanel/migrations/0001_init.sql": await tpl("migration.postgresql.sql.txt"),
    });
    const check = await checkNamed("Audit log table");
    expect(check?.hint).toContain("doctor --fix");
    expect(await check?.fix?.()).toEqual({
      path: "flowpanel/migrations/0002_audit_log_0_4.sql",
      content: await tpl("migration-audit.postgresql.sql.txt"),
    });
  });

  it("is quiet for the 0001 that init writes now", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default {};\n",
      "flowpanel/migrations/0001_init.sql": await tpl("migration.postgresql.sql.txt"),
    });
    expect(await checkNamed("Audit log table")).toBeUndefined();
  });
});

describe("doctor — kit installed check", () => {
  it("fails and says how to install when the kit is not installed", async () => {
    await write({ "package.json": PACKAGE, "flowpanel.config.ts": "export default {};\n" });
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

  it("prints hints only on failing checks, warnings and notes in JSON, and flags each", async () => {
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
    expect(named("ESLint plugin")).toMatchObject({ ok: true, info: true });
    expect(named("ESLint plugin")?.hint).toContain("@flowpanel/eslint-plugin");
    for (const check of checks) {
      if (check.ok === true && check.warn !== true && check.info !== true) {
        expect(check).not.toHaveProperty("hint");
      }
    }
  });

  it("prints the ESLint plugin suggestion as a note that is not a warning", async () => {
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/app";
    await installedProject();
    await runDoctorChecks(tmp, true, { quiet: true });
    out.length = 0;
    await doctor();
    const text = out.join("");
    expect(text).toMatch(
      /· ESLint plugin\n {4}Add @flowpanel\/eslint-plugin to your ESLint config/,
    );
    expect(text).toContain("✓ All checks passed.");
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

describe("doctor — ESLint plugin note", () => {
  it("passes once the flat config loads the plugin", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default { resources: [] };\n",
      "eslint.config.mjs":
        'import flowpanel from "@flowpanel/eslint-plugin";\nexport default [flowpanel.configs.recommended];\n',
    });
    expect(await checkNamed("ESLint plugin")).toEqual({ name: "ESLint plugin", ok: true });
  });

  it("passes when the workspace root above the project loads the plugin", async () => {
    await write({
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      "eslint.config.mjs":
        'import flowpanel from "@flowpanel/eslint-plugin";\nexport default [flowpanel.configs.recommended];\n',
      "apps/admin/package.json": PACKAGE,
      "apps/admin/flowpanel.config.ts": "export default { resources: [] };\n",
    });
    const { checks } = await runDoctorChecks(path.join(tmp, "apps/admin"), false);
    expect(checks.map((check) => check.name)).toContain("Resources configured");
    expect(checks.find((check) => check.name === "ESLint plugin")).toEqual({
      name: "ESLint plugin",
      ok: true,
    });
  });

  it("stops looking at the workspace root", async () => {
    await write({
      "eslint.config.mjs": 'import flowpanel from "@flowpanel/eslint-plugin";\n',
      "repo/pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      "repo/apps/admin/package.json": PACKAGE,
      "repo/apps/admin/flowpanel.config.ts": "export default { resources: [] };\n",
    });
    const { checks } = await runDoctorChecks(path.join(tmp, "repo/apps/admin"), false);
    expect(checks.find((check) => check.name === "ESLint plugin")).toMatchObject({ info: true });
  });

  it("no longer fails doctor over a destructive action, which the lint rule reports", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts":
        'export default { resources: [{ name: "users", actions: [{ key: "purge", variant: "destructive" }] }] };\n',
    });
    const { checks } = await runDoctorChecks(tmp, false);
    expect(checks.map((check) => check.name)).not.toContain("Destructive actions have confirm");
  });
});

describe("doctor — a probe that crashes", () => {
  it("shows a warning naming the check and the error instead of dropping it", async () => {
    await write({
      "package.json": PACKAGE,
      "flowpanel.config.ts": "export default { resources: [] };\n",
      "app/admin/users/page.tsx/keep": "",
    });
    const check = await checkNamed("Ejected admin pages carry the eject marker");
    expect(check).toMatchObject({ ok: true, warn: true });
    expect(check?.hint).toMatch(/^Could not check: EISDIR/);
    expect(check?.hint).not.toContain("\n");
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

  it("names a failed next typegen as the reason tsc failed", async () => {
    await installedProject({
      "node_modules/next/bin/next.js":
        'process.stderr.write("Error: typegen could not read next.config.ts\\n");\nprocess.exit(1);\n',
    });
    const check = (await runDoctorChecks(tmp, false)).checks.find(
      (entry) => entry.name === "tsc --noEmit",
    );
    expect(check?.ok).toBe(false);
    expect(check?.hint).toMatch(/^next typegen failed, so tsc ran without the route types/);
    expect(check?.hint).toContain("Error: typegen could not read next.config.ts");
    expect(check?.hint).toContain("tsc then reported:");
    expect(check?.hint).toContain("NEXT_GLOBAL");
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
