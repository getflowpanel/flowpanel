import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";

export type DependencySection =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

export interface PackageManifest {
  name?: string;
  version?: string;
  engines?: { node?: string };
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  packageManager?: string;
}

export interface DependencyInspection {
  name: string;
  declaration: { section: DependencySection; specifier: string } | null;
  installed: { directory: string; manifest: PackageManifest; version: string } | null;
  /** Missing and malformed installs must not be conflated with a declaration. */
  error: "unresolved" | "invalid-manifest" | "pnp-only" | null;
}

const SECTIONS: DependencySection[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export async function readPackageManifest(file: string): Promise<PackageManifest | null> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as PackageManifest)
      : null;
  } catch {
    return null;
  }
}

export async function projectManifest(cwd: string): Promise<PackageManifest | null> {
  return readPackageManifest(path.join(cwd, "package.json"));
}

/**
 * Resolves only package directories using Node's search paths. It never resolves
 * an entrypoint, imports package code, or walks unreachable package-manager stores.
 */
export async function resolvePackageDirectoryFrom(
  fromDirectory: string,
  name: string,
  projectRoot = fromDirectory,
): Promise<string | null> {
  const root = await fs.realpath(projectRoot).catch(() => projectRoot);
  const from = path.join(
    await fs.realpath(fromDirectory).catch(() => fromDirectory),
    "package.json",
  );
  const directories = createRequire(from).resolve.paths(name) ?? [];
  for (const directory of directories) {
    // Node's own resolution order, minus NODE_PATH and the per-user global
    // lookup directories: those would turn this machine's packages into the
    // project's installed evidence. Ancestor `node_modules` stay in, because a
    // hoisted npm/yarn/bun workspace installs the project's tree there.
    if (!isReachableNodeModules(directory, root)) continue;
    try {
      return await fs.realpath(path.join(directory, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

/** A `node_modules` inside the project, or one belonging to the project or an ancestor. */
function isReachableNodeModules(directory: string, root: string): boolean {
  if (path.basename(directory) !== "node_modules") return false;
  if (directory.startsWith(`${root}${path.sep}`)) return true;
  const owner = path.dirname(directory);
  const prefix = owner.endsWith(path.sep) ? owner : `${owner}${path.sep}`;
  return root === owner || root.startsWith(prefix);
}

export async function resolvePackageDirectory(cwd: string, name: string): Promise<string | null> {
  return resolvePackageDirectoryFrom(cwd, name, cwd);
}

const LOCKFILES = ["yarn.lock", "pnpm-lock.yaml", "package-lock.json", "bun.lock", "bun.lockb"];

const exists = (file: string) =>
  fs
    .access(file)
    .then(() => true)
    .catch(() => false);

/**
 * A PnP install writes `.pnp.cjs` beside the workspace's own manifest, which may
 * be an ancestor of `cwd`. The walk stops at the install root: a `.pnp.cjs`
 * further up belongs to a different project and says nothing about this one.
 */
async function hasPnpManifest(cwd: string): Promise<boolean> {
  let directory = cwd;
  for (;;) {
    if (
      (await exists(path.join(directory, ".pnp.cjs"))) &&
      (await exists(path.join(directory, "package.json")))
    ) {
      return true;
    }
    const atInstallRoot = (
      await Promise.all(LOCKFILES.map((lock) => exists(path.join(directory, lock))))
    ).some(Boolean);
    const parent = path.dirname(directory);
    if (atInstallRoot || parent === directory) return false;
    directory = parent;
  }
}

export async function inspectDependency(cwd: string, name: string): Promise<DependencyInspection> {
  const host = await projectManifest(cwd);
  let declaration: DependencyInspection["declaration"] = null;
  for (const section of SECTIONS) {
    const specifier = host?.[section]?.[name];
    if (typeof specifier === "string") {
      declaration = { section, specifier };
      break;
    }
  }

  const directory = await resolvePackageDirectory(cwd, name);
  if (directory === null) {
    return {
      name,
      declaration,
      installed: null,
      error: (await hasPnpManifest(cwd)) ? "pnp-only" : "unresolved",
    };
  }
  const manifest = await readPackageManifest(path.join(directory, "package.json"));
  if (!manifest || typeof manifest.version !== "string") {
    return { name, declaration, installed: null, error: "invalid-manifest" };
  }
  return {
    name,
    declaration,
    installed: { directory, manifest, version: manifest.version },
    error: null,
  };
}
