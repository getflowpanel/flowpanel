import { readPkg } from "./detect";

export type AuthProvider = "better-auth" | "next-auth" | "clerk" | "lucia";

const PACKAGES: ReadonlyArray<readonly [AuthProvider, string]> = [
  ["better-auth", "better-auth"],
  ["next-auth", "next-auth"],
  ["clerk", "@clerk/nextjs"],
  ["lucia", "lucia"],
];

/** Which auth provider this project already depends on, in preset order. */
export async function detectAuthProvider(cwd: string): Promise<AuthProvider | null> {
  const pkg = await readPkg(cwd);
  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
  };
  return PACKAGES.find(([, name]) => name in deps)?.[0] ?? null;
}

/**
 * The FlowPanel preset each provider maps to, and the export the generated
 * session module reads from the project's own auth instance. Clerk needs none:
 * `withClerk` imports `@clerk/nextjs/server` itself.
 */
export const AUTH_PRESETS: Record<AuthProvider, { preset: string; instance: string | null }> = {
  "better-auth": { preset: "withBetterAuth", instance: "auth" },
  "next-auth": { preset: "withNextAuth", instance: "auth" },
  clerk: { preset: "withClerk", instance: null },
  lucia: { preset: "withLucia", instance: "lucia" },
};
