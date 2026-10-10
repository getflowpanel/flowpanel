import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createFilesystemPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent } from "../plan/types";
import { configImportFor, detectAppDir, detectPathAlias } from "../utils/detect";
import { blockingSegmentExport, usesCacheComponents } from "../utils/next-config";
import { renderTemplate } from "../utils/template";
import { stampMarker } from "./marker";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Resolve the templates root in both dev (running from src/) and prod (running from dist/). */
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
  /** The admin mount, e.g. "/admin" or "/ops/admin"; ejected files land under it. */
  adminPath?: string;
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

async function stampedIntent(
  templatePath: string,
  destination: string,
  vars: Record<string, string>,
  version: string,
  force: boolean,
  cwd: string,
): Promise<FileIntent> {
  const raw = await fs.readFile(templatePath, "utf8");
  const name = path.relative(path.dirname(path.dirname(templatePath)), templatePath);
  const substituted = renderTemplate(raw, vars, `ejected/${name.split(path.sep).join("/")}`);
  const stamped = stampMarker(substituted, version);
  return {
    path: path.relative(cwd, destination),
    content: stamped,
    ...(force ? { overwrite: true } : {}),
  };
}

async function applyIntents(cwd: string, intents: FileIntent[]): Promise<string[]> {
  const plan = await createFilesystemPlan(cwd, intents);
  const conflict = plan.operations.find((operation) => operation.kind === "conflict");
  if (conflict) {
    throw new Error(
      `Eject target already exists: ${conflict.path} (pass force: true to overwrite)`,
    );
  }
  const written = await applyFilesystemPlan(plan);
  return written.map((file) => path.join(cwd, file));
}

export async function resourceTemplateIntents(opts: CopyResourceOptions): Promise<FileIntent[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const appDir = await detectAppDir(opts.cwd);
  const mount = opts.adminPath ?? "/admin";
  const targetDir = path.join(opts.cwd, appDir, mount, opts.resourceName);
  const aliasMode = await detectPathAlias(opts.cwd);
  const configImport = configImportFor(`${appDir}${mount}/${opts.resourceName}`, aliasMode);
  const segmentConfig = blockingSegmentExport(await usesCacheComponents(opts.cwd));
  const intents: FileIntent[] = [];

  for (const [srcRel, destRel] of RESOURCE_LAYOUT) {
    const dest = path.join(targetDir, destRel);
    intents.push(
      await stampedIntent(
        path.join(templatesRoot, srcRel),
        dest,
        { name: opts.resourceName, CONFIG_IMPORT: configImport, SEGMENT_CONFIG: segmentConfig },
        opts.version,
        opts.force ?? false,
        opts.cwd,
      ),
    );
  }
  return intents;
}

export async function copyResourceTemplates(opts: CopyResourceOptions): Promise<string[]> {
  return applyIntents(opts.cwd, await resourceTemplateIntents(opts));
}

/** Eject a dashboard. */
export async function dashboardTemplateIntents(opts: CopyDashboardOptions): Promise<FileIntent[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const appDir = await detectAppDir(opts.cwd);
  const normalized = opts.dashboardPath === "/" ? "" : opts.dashboardPath.replace(/^\//, "");
  const dest = path.join(opts.cwd, appDir, opts.adminPath ?? "/admin", normalized, "page.tsx");

  return [
    await stampedIntent(
      path.join(templatesRoot, "dashboard/page.tsx.txt"),
      dest,
      {
        path: opts.dashboardPath,
        SEGMENT_CONFIG: blockingSegmentExport(await usesCacheComponents(opts.cwd)),
      },
      opts.version,
      opts.force ?? false,
      opts.cwd,
    ),
  ];
}

export async function copyDashboardTemplate(opts: CopyDashboardOptions): Promise<string[]> {
  return applyIntents(opts.cwd, await dashboardTemplateIntents(opts));
}

/** Eject the admin layout. */
export async function layoutTemplateIntents(opts: CopyLayoutOptions): Promise<FileIntent[]> {
  const templatesRoot = await resolveTemplatesRoot();
  const appDir = await detectAppDir(opts.cwd);
  const mount = opts.adminPath ?? "/admin";
  const layoutDir = `${appDir}${mount}`;
  const dest = path.join(opts.cwd, layoutDir, "layout.tsx");
  const aliasMode = await detectPathAlias(opts.cwd);
  const cssFile = aliasMode === "strip-src" ? "src/styles/admin.css" : "styles/admin.css";
  const cssImport =
    aliasMode === "none"
      ? path.relative(layoutDir, cssFile).split(path.sep).join("/")
      : "@/styles/admin.css";

  return [
    await stampedIntent(
      path.join(templatesRoot, "layout/layout.tsx.txt"),
      dest,
      {
        CONFIG_IMPORT: configImportFor(layoutDir, aliasMode),
        CSS_IMPORT: cssImport,
        SEGMENT_CONFIG: blockingSegmentExport(await usesCacheComponents(opts.cwd)),
      },
      opts.version,
      opts.force ?? false,
      opts.cwd,
    ),
  ];
}

export async function copyLayoutTemplate(opts: CopyLayoutOptions): Promise<string[]> {
  return applyIntents(opts.cwd, await layoutTemplateIntents(opts));
}
