import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTH_PRESETS, detectAuthProvider } from "../auth-provider";

async function project(pkg: Record<string, unknown>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-auth-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify(pkg));
  return dir;
}

describe("detectAuthProvider", () => {
  it("recognises each supported provider by its package", async () => {
    for (const [provider, dep] of [
      ["better-auth", "better-auth"],
      ["next-auth", "next-auth"],
      ["clerk", "@clerk/nextjs"],
      ["lucia", "lucia"],
    ] as const) {
      const cwd = await project({ dependencies: { next: "^16.3.0", [dep]: "^1.0.0" } });
      expect(await detectAuthProvider(cwd)).toBe(provider);
    }
  });

  it("looks in devDependencies too", async () => {
    const cwd = await project({ devDependencies: { "better-auth": "^1.0.0" } });
    expect(await detectAuthProvider(cwd)).toBe("better-auth");
  });

  it("answers null for a project with no auth dependency", async () => {
    expect(
      await detectAuthProvider(await project({ dependencies: { next: "^16.3.0" } })),
    ).toBeNull();
    expect(
      await detectAuthProvider(await fs.mkdtemp(path.join(os.tmpdir(), "fp-auth-"))),
    ).toBeNull();
  });

  it("prefers better-auth when a project carries two", async () => {
    const cwd = await project({ dependencies: { "next-auth": "^5.0.0", "better-auth": "^1.0.0" } });
    expect(await detectAuthProvider(cwd)).toBe("better-auth");
  });

  it("maps every provider to a preset, and only Clerk needs no instance", () => {
    expect(AUTH_PRESETS["better-auth"]).toEqual({ preset: "withBetterAuth", instance: "auth" });
    expect(AUTH_PRESETS.clerk.instance).toBeNull();
    expect(Object.keys(AUTH_PRESETS)).toHaveLength(4);
  });
});
