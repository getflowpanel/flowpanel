import { inspectDependency, projectManifest } from "./project-packages";

/** The message to print when `cwd` is not a Next.js project root, or `null` when it is one. */
export async function noNextProject(cwd: string): Promise<string | null> {
  const manifest = await projectManifest(cwd);
  if (manifest !== null) {
    const next = await inspectDependency(cwd, "next");
    if (next.declaration !== null || next.installed !== null) return null;
  }
  return `No Next.js project found in ${cwd}. Run this from your project root.`;
}
