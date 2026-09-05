import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  type PackageManifest,
  readPackageManifest,
  resolvePackageDirectoryFrom,
} from "../utils/project-packages";

/** Count reachable installations, not unreferenced versions left in a package-manager store. */
export async function countCoreInstances(cwd: string): Promise<number | null> {
  try {
    await fs.access(path.join(cwd, "node_modules"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const manifests = new Map<string, PackageManifest>();
  const visited = new Set<string>();
  const cores = new Set<string>();
  let installed = false;

  // One unreadable manifest left behind by an interrupted install must not
  // silently cancel the whole duplicate-core check; skip that branch instead.
  async function read(dir: string): Promise<PackageManifest | null> {
    const cached = manifests.get(dir);
    if (cached) return cached;
    const manifest = await readPackageManifest(path.join(dir, "package.json"));
    if (manifest === null) return null;
    manifests.set(dir, manifest);
    return manifest;
  }

  const root = await fs.realpath(cwd);
  const queue = [root];
  while (queue.length) {
    const dir = queue.pop() as string;
    if (visited.has(dir)) continue;
    visited.add(dir);
    const manifest = await read(dir);
    if (manifest === null) continue;
    if (dir !== root) installed = true;
    if (manifest.name === "@flowpanel/core") cores.add(dir);
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
      ...(dir === root ? manifest.devDependencies : {}),
    };
    for (const name of Object.keys(dependencies)) {
      const target = await resolvePackageDirectoryFrom(dir, name, root);
      if (target && !visited.has(target)) queue.push(target);
    }
  }
  return installed ? cores.size : null;
}
