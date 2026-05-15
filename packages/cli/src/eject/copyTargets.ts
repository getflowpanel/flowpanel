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
    path.join(HERE, "..", "templates", "ejected"),
    path.join(HERE, "..", "..", "templates", "ejected"),
    path.join(HERE, "templates", "ejected"),
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

interface BaseCopyOptions {
  cwd: string;
  version: string;
  force?: boolean;
}

export interface CopyResourceOptions extends BaseCopyOptions {
  resourceName: string;
}

export interface CopyDashboardOptions extends BaseCopyOptions {
  /** Dashboard config path, e.g. "/" or "/monitoring". */
  dashboardPath: string;
}

export type CopyLayoutOptions = BaseCopyOptions;

const RESOURCE_LAYOUT: ReadonlyArray<readonly [srcRel: string, destRel: string]> = [
  ["resource/page.tsx.txt", "page.tsx"],
  ["resource/new-page.tsx.txt", "new/page.tsx"],
  ["resource/id-page.tsx.txt", "[id]/page.tsx"],
  ["resource/id-edit-page.tsx.txt", "[id]/edit/page.tsx"],
  ["resource/actions.ts.txt", "actions.ts"],
];

async function writeStamped(
  templatePath: string,
  destPath: string,
  vars: Record<string, string>,
  version: string,
  force: boolean,
  cwd: string,
): Promise<void> {
  if (!force) {
    try {
      await fs.access(destPath);
      throw new Error(
        `Eject target already exists: ${path.relative(cwd, destPath)} (pass force: true to overwrite)`,
      );
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
    }
  }
  const raw = await fs.readFile(templatePath, "utf8");
  const substituted = Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value),
    raw,
  );
  const stamped = stampMarker(substituted, version);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, stamped, "utf8");
}

export async function copyResourceTemplates(opts: CopyResourceOptions): Promise<string[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const targetDir = path.join(opts.cwd, "app/admin", opts.resourceName);
  const written: string[] = [];

  for (const [srcRel, destRel] of RESOURCE_LAYOUT) {
    const dest = path.join(targetDir, destRel);
    await writeStamped(
      path.join(templatesRoot, srcRel),
      dest,
      { name: opts.resourceName },
      opts.version,
      opts.force ?? false,
      opts.cwd,
    );
    written.push(dest);
  }
  return written;
}

/**
 * Eject a dashboard. Writes a single `app/admin/<path>/page.tsx` (root
 * dashboard at `path: "/"` lands at `app/admin/page.tsx`).
 */
export async function copyDashboardTemplate(opts: CopyDashboardOptions): Promise<string[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const normalized = opts.dashboardPath === "/" ? "" : opts.dashboardPath.replace(/^\//, "");
  const dest = path.join(opts.cwd, "app/admin", normalized, "page.tsx");

  await writeStamped(
    path.join(templatesRoot, "dashboard/page.tsx.txt"),
    dest,
    { path: opts.dashboardPath },
    opts.version,
    opts.force ?? false,
    opts.cwd,
  );
  return [dest];
}

/**
 * Eject the admin layout. Writes `app/admin/layout.tsx` that wraps
 * children in `<AdminShell>` from @flowpanel/react.
 */
export async function copyLayoutTemplate(opts: CopyLayoutOptions): Promise<string[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const dest = path.join(opts.cwd, "app/admin", "layout.tsx");

  await writeStamped(
    path.join(templatesRoot, "layout/layout.tsx.txt"),
    dest,
    {},
    opts.version,
    opts.force ?? false,
    opts.cwd,
  );
  return [dest];
}
