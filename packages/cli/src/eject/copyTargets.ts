import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { stampMarker } from "./marker.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the templates root in both dev (running from src/) and prod
 * (running from dist/). Mirrors `utils/template.ts`'s strategy.
 */
async function resolveTemplatesRoot(): Promise<string> {
  const candidates = [
    path.join(HERE, "..", "templates", "ejected"), // src layout: src/eject/ → src/templates/ejected
    path.join(HERE, "..", "..", "templates", "ejected"), // dist layout: dist/eject/ → dist/templates/ejected
    path.join(HERE, "templates", "ejected"), // single-bundle dist
  ];
  for (const dir of candidates) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Eject templates not found. Tried: ${candidates.join(", ")}`);
}

export interface CopyResourceOptions {
  cwd: string;
  resourceName: string;
  version: string;
  force?: boolean;
}

const RESOURCE_LAYOUT: ReadonlyArray<readonly [srcRel: string, destRel: string]> = [
  ["resource/page.tsx.txt", "page.tsx"],
  ["resource/new-page.tsx.txt", "new/page.tsx"],
  ["resource/id-page.tsx.txt", "[id]/page.tsx"],
  ["resource/id-edit-page.tsx.txt", "[id]/edit/page.tsx"],
  ["resource/actions.ts.txt", "actions.ts"],
];

export async function copyResourceTemplates(opts: CopyResourceOptions): Promise<string[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const targetDir = path.join(opts.cwd, "app/admin", opts.resourceName);
  const written: string[] = [];

  for (const [srcRel, destRel] of RESOURCE_LAYOUT) {
    const dest = path.join(targetDir, destRel);
    if (!opts.force) {
      try {
        await fs.access(dest);
        throw new Error(
          `Eject target already exists: ${path.relative(opts.cwd, dest)} (pass force: true to overwrite)`,
        );
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
      }
    }
    const tplPath = path.join(templatesRoot, srcRel);
    const raw = await fs.readFile(tplPath, "utf8");
    const substituted = raw.replace(/\{\{\s*name\s*\}\}/g, opts.resourceName);
    const stamped = stampMarker(substituted, opts.version);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, stamped, "utf8");
    written.push(dest);
  }
  return written;
}
