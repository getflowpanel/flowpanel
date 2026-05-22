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

/**
 * How the project maps `@/*` to filesystem paths in `tsconfig.json`.
 * - `strip-src` — `paths: { "@/*": ["src/*"] }` (or `"./src/*"`). The `src/`
 *   prefix is stripped when emitting an import alias (`src/db/x` → `@/db/x`).
 * - `root` — `paths: { "@/*": ["./*"] }` (or `"*"`). The alias keeps the full
 *   path (`src/db/x` → `@/src/db/x`).
 * - `none` — no `@/*` alias, or unreadable tsconfig. Caller should fall back
 *   to a relative path from the cwd-root config file.
 */
export type PathAliasMode = "strip-src" | "root" | "none";

export async function detectPathAlias(cwd: string): Promise<PathAliasMode> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(cwd, "tsconfig.json"), "utf8");
  } catch {
    return "none";
  }
  // Tolerate trailing commas and `//` comments — Next.js scaffolds emit both.
  const stripped = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
  let parsed: { compilerOptions?: { paths?: Record<string, string[]> } };
  try {
    parsed = JSON.parse(stripped) as typeof parsed;
  } catch {
    return "none";
  }
  const targets = parsed.compilerOptions?.paths?.["@/*"];
  if (!targets || targets.length === 0) return "none";
  // Normalize: strip leading `./`.
  const first = targets[0]?.replace(/^\.\//, "");
  if (first === "src/*") return "strip-src";
  if (first === "*" || first === "./*") return "root";
  // Anything exotic — fall back to relative paths.
  return "none";
}

/**
 * Resolves a relative source path (`src/db/client.ts`) to the import string the
 * scaffold should emit, given the project's tsconfig alias setup.
 */
export function aliasOf(relPath: string, mode: PathAliasMode): string {
  const noExt = relPath.replace(/\.tsx?$/, "");
  if (mode === "strip-src") return `@/${noExt.replace(/^src\//, "")}`;
  if (mode === "root") return `@/${noExt}`;
  // `mode === "none"`: fall back to a relative path from cwd root (where
  // flowpanel.config.ts lives). Keep the `./` prefix to make it explicit.
  return `./${noExt}`;
}

async function firstMatch(
  cwd: string,
  candidates: string[],
  mode: PathAliasMode,
): Promise<string | null> {
  for (const c of candidates) {
    if (await fileExists(path.join(cwd, c))) {
      return aliasOf(c, mode);
    }
  }
  return null;
}

export async function detectDbClient(cwd: string, mode?: PathAliasMode): Promise<string | null> {
  return firstMatch(
    cwd,
    [
      "src/server/lib/db.ts",
      "src/lib/db.ts",
      "server/lib/db.ts",
      "lib/db.ts",
      "src/db/client.ts",
      "src/db/index.ts",
      "src/db.ts",
      "db/client.ts",
      "db/index.ts",
    ],
    mode ?? (await detectPathAlias(cwd)),
  );
}

export async function detectSchema(cwd: string, mode?: PathAliasMode): Promise<string | null> {
  return firstMatch(
    cwd,
    [
      "src/server/lib/db/schema.ts",
      "src/lib/db/schema.ts",
      "server/lib/db/schema.ts",
      "lib/db/schema.ts",
      "src/db/schema.ts",
      "src/schema.ts",
      "db/schema.ts",
    ],
    mode ?? (await detectPathAlias(cwd)),
  );
}

export async function detectAuth(cwd: string, mode?: PathAliasMode): Promise<string | null> {
  return firstMatch(
    cwd,
    [
      "src/server/lib/auth.ts",
      "src/lib/auth.ts",
      "server/lib/auth.ts",
      "lib/auth.ts",
      "src/auth.ts",
    ],
    mode ?? (await detectPathAlias(cwd)),
  );
}

/**
 * Where the Next.js App Router root lives in this project.
 * - `"app"` — `app/` at the repo root (default Next.js scaffold).
 * - `"src/app"` — `src/app/` (also officially supported by Next.js).
 *
 * Resolution order: if `app/` exists at the root → `"app"`. Otherwise, if
 * `src/app/` exists → `"src/app"`. Otherwise `"app"` (so a fresh project gets
 * the standard scaffold).
 */
export async function detectAppDir(cwd: string): Promise<"app" | "src/app"> {
  if (await fileExists(path.join(cwd, "app"))) return "app";
  if (await fileExists(path.join(cwd, "src", "app"))) return "src/app";
  return "app";
}
