import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface Stack {
  nextjs: string | null;
  nextjsMajor: number | null;
  typescript: boolean;
  drizzle: boolean;
  prisma: boolean;
  bullmq: boolean;
  tailwind: boolean;
  tailwindMajor: number | null;
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readPkg(cwd: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function majorOf(v: string | undefined): number | null {
  if (!v) return null;
  const m = /(\d+)/.exec(v);
  return m?.[1] ? Number(m[1]) : null;
}

export async function detectStack(cwd: string): Promise<Stack> {
  const pkg = await readPkg(cwd);
  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
  };
  const tw = deps.tailwindcss;
  return {
    nextjs: deps.next ?? null,
    nextjsMajor: majorOf(deps.next),
    typescript: !!deps.typescript,
    drizzle: !!deps["drizzle-orm"],
    prisma: !!deps["@prisma/client"],
    bullmq: !!deps.bullmq,
    tailwind: !!tw,
    tailwindMajor: majorOf(tw),
  };
}

async function firstMatch(cwd: string, candidates: string[]): Promise<string | null> {
  for (const c of candidates) {
    if (await fileExists(path.join(cwd, c))) {
      return `@/${c.replace(/\.ts$/, "").replace(/^src\//, "")}`;
    }
  }
  return null;
}

export async function detectDbClient(cwd: string): Promise<string | null> {
  return firstMatch(cwd, [
    "src/server/lib/db.ts",
    "src/lib/db.ts",
    "server/lib/db.ts",
    "lib/db.ts",
    "src/db/index.ts",
    "src/db.ts",
  ]);
}

export async function detectSchema(cwd: string): Promise<string | null> {
  return firstMatch(cwd, [
    "src/server/lib/db/schema.ts",
    "src/lib/db/schema.ts",
    "server/lib/db/schema.ts",
    "lib/db/schema.ts",
    "src/db/schema.ts",
    "src/schema.ts",
  ]);
}

export async function detectAuth(cwd: string): Promise<string | null> {
  return firstMatch(cwd, [
    "src/server/lib/auth.ts",
    "src/lib/auth.ts",
    "server/lib/auth.ts",
    "lib/auth.ts",
    "src/auth.ts",
  ]);
}
