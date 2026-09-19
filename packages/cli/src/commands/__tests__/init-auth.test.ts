import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { planAuthSession } from "../init-auth";

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
