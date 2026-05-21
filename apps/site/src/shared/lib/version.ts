import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reads the umbrella package's version at build time.
 * Inlined into pages via React Server Components, so no runtime cost.
 */
function readPackageVersion(): string {
  try {
    const pkgPath = resolve(__dirname, "../../../../../packages/flowpanel/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

export const flowpanelVersion = readPackageVersion();
