import * as fs from "node:fs/promises";
import * as path from "node:path";
import { readTsconfigOptions } from "./tsconfig";

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

/** True when the declared range names a Next.js release FlowPanel supports. */
export function isSupportedNextVersion(version: string | null): boolean {
  if (!version) return false;
  const match = /(\d+)\.(\d+)/.exec(version);
  if (!match?.[1] || !match[2]) return false;
  return Number(match[1]) === 16 && Number(match[2]) >= 3;
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

/** How the project maps `@/*` to filesystem paths in `tsconfig.json`. */
export type PathAliasMode = "strip-src" | "root" | "none";

export async function detectPathAlias(cwd: string): Promise<PathAliasMode> {
  const compilerOptions = await readTsconfigOptions(cwd);
  const targets = compilerOptions?.paths?.["@/*"];
  if (!targets || targets.length === 0) return "none";
  const first = targets[0]?.replace(/^\.\//, "");
  if (first === "src/*") return "strip-src";
  if (first === "*" || first === "./*") return "root";
  return "none";
}

export function aliasOf(relPath: string, mode: PathAliasMode): string {
  const noExt = relPath.replace(/\.tsx?$/, "");
  if (mode === "strip-src") return `@/${noExt.replace(/^src\//, "")}`;
  if (mode === "root") return `@/${noExt}`;
  return `./${noExt}`;
}

export function configImportFor(fileDir: string, mode: PathAliasMode): string {
  if (mode === "root") return "@/flowpanel.config";
  const rel = path.relative(fileDir, ".").split(path.sep).join("/");
  return rel === "" ? "./flowpanel.config" : `${rel}/flowpanel.config`;
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
      "src/lib/prisma.ts",
      "lib/prisma.ts",
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

/** Where the Next.js App Router root lives in this project. */
export async function detectAppDir(cwd: string): Promise<"app" | "src/app"> {
  if (await fileExists(path.join(cwd, "app"))) return "app";
  if (await fileExists(path.join(cwd, "src", "app"))) return "src/app";
  return "app";
}

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("npm")) return "npm";
  if (await fileExists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(path.join(cwd, "yarn.lock"))) return "yarn";
  if (
    (await fileExists(path.join(cwd, "bun.lockb"))) ||
    (await fileExists(path.join(cwd, "bun.lock")))
  )
    return "bun";
  if (await fileExists(path.join(cwd, "package-lock.json"))) return "npm";
  return "npm";
}

/** How to add a dependency and run a local binary / script for each manager. */
interface PmCommands {
  /** `add ["-D"] <pkg>` argv for the install spawn. */
  add(pkg: string, dev: boolean): string[];
  /** The displayed command to add a dependency manually (outro fallback). */
  addDisplay(pkg: string, dev: boolean): string;
  /** Runs a project-local binary, e.g. `pnpm flowpanel` / `npx flowpanel`. */
  exec: string;
  /** Runs a published package's binary without installing it, e.g. `pnpm dlx <pkg>`. */
  dlx: string;
  /** argv passed to `exec` to run a project-local binary with arguments. */
  execArgs(bin: string, args: string[]): string[];
  /** Runs a package.json script, e.g. `pnpm dev` / `npm run dev`. */
  run: string;
}

/** The spawnable name of a package-manager binary: Windows needs the `.cmd` shim. */
export function platformBin(bin: string): string {
  return process.platform === "win32" ? `${bin}.cmd` : bin;
}

export function pmCommands(pm: PackageManager): PmCommands {
  switch (pm) {
    case "npm":
      return {
        add: (pkg, dev) => ["install", dev ? "--save-dev" : "--save", pkg],
        addDisplay: (pkg, dev) => `npm install ${dev ? "--save-dev " : ""}${pkg}`,
        exec: "npx",
        dlx: "npx",
        execArgs: (bin, args) => [bin, ...args],
        run: "npm run",
      };
    case "yarn":
      return {
        add: (pkg, dev) => (dev ? ["add", "-D", pkg] : ["add", pkg]),
        addDisplay: (pkg, dev) => `yarn add ${dev ? "-D " : ""}${pkg}`,
        exec: "yarn",
        dlx: "yarn dlx",
        execArgs: (bin, args) => [bin, ...args],
        run: "yarn",
      };
    case "bun":
      return {
        add: (pkg, dev) => (dev ? ["add", "-d", pkg] : ["add", pkg]),
        addDisplay: (pkg, dev) => `bun add ${dev ? "-d " : ""}${pkg}`,
        exec: "bunx",
        dlx: "bunx",
        execArgs: (bin, args) => [bin, ...args],
        run: "bun run",
      };
    default:
      return {
        add: (pkg, dev) => (dev ? ["add", "-D", pkg] : ["add", pkg]),
        addDisplay: (pkg, dev) => `pnpm add ${dev ? "-D " : ""}${pkg}`,
        exec: "pnpm",
        dlx: "pnpm dlx",
        execArgs: (bin, args) => ["exec", bin, ...args],
        run: "pnpm",
      };
  }
}
