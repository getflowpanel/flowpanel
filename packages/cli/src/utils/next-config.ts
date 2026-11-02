import * as fs from "node:fs/promises";
import * as path from "node:path";

const NEXT_CONFIG_FILES = [
  "next.config.ts",
  "next.config.mts",
  "next.config.mjs",
  "next.config.js",
  "next.config.cjs",
];

/** The first Next.js that reads `export const instant`; 16.2 only knows `unstable_instant`. */
export const CACHE_COMPONENTS_NEXT = "16.3.0";

/** True when the project's next.config turns on `cacheComponents`, as `create-next-app` does from Next.js 16.4. */
export async function usesCacheComponents(cwd: string): Promise<boolean> {
  for (const name of NEXT_CONFIG_FILES) {
    const source = await fs.readFile(path.join(cwd, name), "utf8").catch(() => null);
    if (source !== null) return /\bcacheComponents\s*:\s*true\b/.test(source);
  }
  return false;
}

/** The segment line that lets an admin layout or page read the request and the database before it renders, which `cacheComponents` refuses otherwise. */
export function blockingSegmentExport(cacheComponents: boolean): string {
  return cacheComponents ? "export const instant = false;\n\n" : "";
}
