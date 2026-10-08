import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { tpl } from "../../utils/template";
import { planAuthSession, planDevStubReplacement } from "../init-auth";

async function project(authModule: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-initauth-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "host" }));
  await fs.writeFile(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
  );
  await fs.mkdir(path.join(dir, "src/lib"), { recursive: true });
  await fs.writeFile(path.join(dir, "src/lib/auth.ts"), authModule);
  return dir;
}

const INSTANCE = "export const auth = { api: { getSession: async () => null } };\n";
const WIRED = "export async function getSession(): Promise<null> { return null; }\n";

describe("planAuthSession", () => {
  it("bridges a better-auth instance through the preset", async () => {
    const cwd = await project(INSTANCE);
    expect(
      await planAuthSession({
        cwd,
        provider: "better-auth",
        detectedAuth: "@/lib/auth",
        aliasMode: "strip-src",
        devAuth: false,
      }),
    ).toEqual({
      provider: "better-auth",
      file: "src/server/lib/flowpanel-session.ts",
      specifier: "@/server/lib/flowpanel-session",
      template: "auth-session.better-auth.ts.txt",
      vars: { AUTH_MODULE: "@/lib/auth" },
    });
  });

  it("leaves a module that already exports getSession alone", async () => {
    const cwd = await project(WIRED);
    expect(
      await planAuthSession({
        cwd,
        provider: "better-auth",
        detectedAuth: "@/lib/auth",
        aliasMode: "strip-src",
        devAuth: false,
      }),
    ).toBeNull();
  });

  it("plans Clerk without any project module, since the preset imports its own", async () => {
    const cwd = await project(INSTANCE);
    const plan = await planAuthSession({
      cwd,
      provider: "clerk",
      detectedAuth: null,
      aliasMode: "root",
      devAuth: false,
    });
    expect(plan).toMatchObject({
      file: "server/lib/flowpanel-session.ts",
      specifier: "@/server/lib/flowpanel-session",
      template: "auth-session.clerk.ts.txt",
      vars: {},
    });
  });

  it("declines when the provider's own instance export is missing", async () => {
    const cwd = await project(INSTANCE);
    expect(
      await planAuthSession({
        cwd,
        provider: "lucia",
        detectedAuth: "@/lib/auth",
        aliasMode: "strip-src",
        devAuth: false,
      }),
    ).toBeNull();
  });

  it("declines for --dev-auth, for an unrecognised provider, and with nothing detected", async () => {
    const cwd = await project(INSTANCE);
    const base = { cwd, detectedAuth: "@/lib/auth", aliasMode: "strip-src" } as const;
    expect(await planAuthSession({ ...base, provider: "better-auth", devAuth: true })).toBeNull();
    expect(await planAuthSession({ ...base, provider: null, devAuth: false })).toBeNull();
    expect(
      await planAuthSession({ ...base, detectedAuth: null, provider: "lucia", devAuth: false }),
    ).toBeNull();
  });
});

describe("planDevStubReplacement", () => {
  it("swaps the closed stub for the development stub", async () => {
    const closed = await tpl("auth-session.ts.txt");
    const cwd = await project(closed);
    expect(await planDevStubReplacement(cwd, "@/lib/auth")).toEqual({
      kind: "replace",
      file: "src/lib/auth.ts",
      content: await tpl("dev-session.ts.txt", { FILE: "src/lib/auth.ts" }),
      expectedContent: closed,
    });
  });

  it("keeps the development stub replaceable so a re-run reports it unchanged", async () => {
    const cwd = await project(await tpl("dev-session.ts.txt", { FILE: "src/lib/auth.ts" }));
    expect(await planDevStubReplacement(cwd, "@/lib/auth")).toMatchObject({ kind: "replace" });
  });

  it("still recognises the closed stub after formatting changes", async () => {
    const cwd = await project(
      `${await tpl("auth-session.ts.txt")}\n`.replace("return null;", "return null"),
    );
    expect(await planDevStubReplacement(cwd, "@/lib/auth")).toMatchObject({ kind: "replace" });
  });

  it("refuses a module that returns a real session", async () => {
    const cwd = await project(
      (await tpl("auth-session.ts.txt")).replace("return null;", "return auth.getSession();"),
    );
    expect(await planDevStubReplacement(cwd, "@/lib/auth")).toEqual({
      kind: "customised",
      file: "src/lib/auth.ts",
    });
  });

  it("has nothing to say about a specifier that resolves to no file", async () => {
    const cwd = await project(WIRED);
    expect(await planDevStubReplacement(cwd, "@/lib/missing")).toBeNull();
  });
});
