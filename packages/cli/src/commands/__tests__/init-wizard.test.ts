import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as p from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../program";
import { CLI_VERSION } from "../../utils/kit";
import { DEV_AUTH_QUESTION } from "../init-prompts";

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clack/prompts")>()),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: (value: unknown) => typeof value === "symbol",
}));

vi.setConfig({ testTimeout: 30_000 });

const text = vi.mocked(p.text);
const confirm = vi.mocked(p.confirm);

let project: string;
let answers: Record<string, unknown[]>;

const INSTALLED: Record<string, string> = {
  next: "16.3.4",
  react: "19.2.0",
  "react-dom": "19.2.0",
  "drizzle-orm": "0.45.2",
  typescript: "5.9.3",
  "@flowpanel/kit": CLI_VERSION,
  "@flowpanel/cli": CLI_VERSION,
};

async function write(files: Record<string, string>): Promise<void> {
  for (const [file, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(project, file)), { recursive: true });
    await fs.writeFile(path.join(project, file), contents);
  }
}

function setTty(value: boolean): void {
  for (const stream of [process.stdin, process.stdout]) {
    Object.defineProperty(stream, "isTTY", { value, configurable: true });
  }
}

beforeEach(async () => {
  project = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fp-wizard-")));
  const modules = Object.fromEntries(
    Object.entries(INSTALLED).map(([name, version]) => [
      `node_modules/${name}/package.json`,
      JSON.stringify({ name, version, engines: { node: ">=20" } }),
    ]),
  );
  await write({
    ...modules,
    "package.json": JSON.stringify({
      name: "fixture",
      packageManager: "npm@10.9.0",
      dependencies: { ...INSTALLED, typescript: undefined, "@flowpanel/cli": undefined },
      devDependencies: { typescript: "5.9.3", "@flowpanel/cli": CLI_VERSION },
    }),
    "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    "src/app/page.tsx": "export default function Page() { return null; }\n",
    "src/server/lib/db.ts": "export const db = {};\n",
    "src/server/lib/db/schema.ts": "export const users = {};\n",
  });
  answers = {};
  text.mockReset().mockImplementation(async (options) => {
    if (text.mock.calls.length > 20) throw new Error("the wizard kept asking");
    const key = options.message.split("\n")[0] ?? "";
    return (answers[key]?.shift() as string | undefined) ?? options.initialValue ?? "";
  });
  confirm
    .mockReset()
    .mockImplementation(async (options) => !options.message.includes(DEV_AUTH_QUESTION));
  setTty(true);
  vi.spyOn(process, "cwd").mockReturnValue(project);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`);
  }) as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const stream of [process.stdin, process.stdout]) {
    delete (stream as { isTTY?: boolean }).isTTY;
  }
  await fs.rm(project, { recursive: true, force: true });
});

async function init(...args: string[]): Promise<void> {
  await createProgram().parseAsync(["node", "flowpanel", "init", ...args]);
}

const asked = (question: string) =>
  confirm.mock.calls.filter(([options]) => options.message.includes(question));
const textCalls = (message: string) =>
  text.mock.calls.filter(([options]) => options.message.split("\n")[0] === message);
const exists = (file: string) =>
  fs.access(path.join(project, file)).then(
    () => true,
    () => false,
  );

describe("init wizard wiring", () => {
  it("offers the development identity when no session helper exists, defaulting to No", async () => {
    await init();
    expect(asked(DEV_AUTH_QUESTION)).toHaveLength(1);
    expect(asked(DEV_AUTH_QUESTION)[0]?.[0].initialValue).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await fs.readFile(path.join(project, "src/server/lib/auth.ts"), "utf8")).toContain(
      "Promise<Session | null>",
    );
  });

  it("writes the development stub after a yes", async () => {
    confirm.mockImplementation(async () => true);
    await init();
    expect(await fs.readFile(path.join(project, "src/server/lib/auth.ts"), "utf8")).toContain(
      "DEVELOPMENT STUB",
    );
  });

  it("accepts the default auth path without asking again, though nothing exists there", async () => {
    await init();
    expect(textCalls("Auth helper path (must export getSession)")).toHaveLength(1);
  });

  it("skips the question when a session helper already exists", async () => {
    await write({
      "src/server/lib/auth.ts": "export async function getSession() { return null; }\n",
    });
    await init();
    expect(asked(DEV_AUTH_QUESTION)).toHaveLength(0);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("skips the question when --dev-auth is given", async () => {
    await init("--dev-auth");
    expect(asked(DEV_AUTH_QUESTION)).toHaveLength(0);
    expect(await fs.readFile(path.join(project, "src/server/lib/auth.ts"), "utf8")).toContain(
      "DEVELOPMENT STUB",
    );
  });

  it("never prompts under --yes", async () => {
    await init("--yes");
    expect(text).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(await exists("flowpanel.config.ts")).toBe(true);
  });

  it("asks the db question again, with the reason, until the path resolves", async () => {
    answers["Drizzle db client path"] = ["@/lib/nowhere", "@/server/lib/db"];
    await init();
    const calls = textCalls("Drizzle db client path");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[0].message).toContain('Cannot resolve "@/lib/nowhere"');
    expect(calls[1]?.[0].initialValue).toBe("@/lib/nowhere");
    expect(await fs.readFile(path.join(project, "flowpanel.config.ts"), "utf8")).toContain(
      'import { db } from "@/server/lib/db";',
    );
  });

  it("asks the schema question again, and the auth question when the module lacks getSession", async () => {
    await write({ "src/server/lib/auth.ts": "export const nothing = 1;\n" });
    answers["Drizzle schema path"] = ["@/nowhere", "@/server/lib/db/schema"];
    answers["Auth helper path (must export getSession)"] = [
      "@/server/lib/auth",
      "@/server/lib/session",
    ];
    await write({
      "src/server/lib/session.ts": "export async function getSession() { return null; }\n",
    });
    await init();
    expect(textCalls("Drizzle schema path")).toHaveLength(2);
    const authCalls = textCalls("Auth helper path (must export getSession)");
    expect(authCalls).toHaveLength(2);
    expect(authCalls[1]?.[0].message).toContain('does not declare export "getSession"');
  });

  it("exits 1 on Ctrl+C at the final question and 0 on an explicit no", async () => {
    confirm.mockImplementation(async (options) =>
      options.message.includes("Apply") ? (Symbol("cancel") as never) : false,
    );
    await expect(init()).rejects.toThrow("exit 1");
    expect(await exists("flowpanel.config.ts")).toBe(false);

    confirm.mockImplementation(async (options) => !options.message.includes("Apply"));
    await init();
    expect(await exists("flowpanel.config.ts")).toBe(false);
  });
});
