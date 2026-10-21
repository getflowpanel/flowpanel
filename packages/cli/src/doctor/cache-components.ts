import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FileIntent } from "../plan/types";
import { adminPageSource, isGeneratedAdminPage } from "../utils/admin-page";
import type { AdminMount } from "../utils/admin-path";
import { CACHE_COMPONENTS_FINDING, type CompatibilityFinding } from "../utils/compatibility";
import { configImportFor, type PathAliasMode } from "../utils/detect";
import type { Check } from "./check";

const REJECTED_EXPORT = /^export\s+const\s+(runtime|dynamic|revalidate|fetchCache)\s*=/gm;
const LITERAL_EXPORT =
  /^export\s+const\s+(?:runtime|dynamic|revalidate|fetchCache)\s*=\s*(?:"[^"\n]*"|'[^'\n]*'|\d+|true|false)[ \t]*;?[ \t]*(?:\r?\n|$)/gm;
const READS_REQUEST = /\b(?:headers|cookies)\(\)/;
const BLOCKING = /^export\s+const\s+instant\s*=\s*false\b/m;

/** What `next build` refuses in FlowPanel's own files under `cacheComponents`, one line per fix. */
export async function cacheComponentsProblems(
  cwd: string,
  files: { routes: string[]; layout: string | null; page: string | null },
): Promise<string[]> {
  const problems: string[] = [];
  const read = (rel: string) => fs.readFile(path.join(cwd, rel), "utf8").catch(() => null);
  for (const rel of [...files.routes, ...[files.page, files.layout].filter((f) => f !== null)]) {
    const source = await read(rel);
    if (source === null) continue;
    for (const match of source.matchAll(REJECTED_EXPORT)) {
      problems.push(`${rel}: remove \`export const ${match[1]}\``);
    }
  }
  if (files.layout) {
    const layout = await read(files.layout);
    if (layout !== null && READS_REQUEST.test(layout) && !BLOCKING.test(layout)) {
      problems.push(`${files.layout}: add \`export const instant = false;\``);
    }
  }
  if (files.page) {
    const page = await read(files.page);
    if (page !== null && !BLOCKING.test(page)) {
      problems.push(`${files.page}: add \`export const instant = false;\``);
    }
  }
  return problems;
}

/** Doctor checks for a project whose next.config turns on `cacheComponents`; none otherwise. */
export async function cacheComponentsChecks(
  cwd: string,
  findings: CompatibilityFinding[],
  appDir: string,
  mount: AdminMount,
  aliasMode: PathAliasMode,
): Promise<Check[]> {
  const finding = findings.find((item) => item.name === CACHE_COMPONENTS_FINDING);
  if (!finding) return [];
  const checks: Check[] = [
    {
      name: finding.name,
      ok: finding.ok,
      hint: `Found ${finding.observed}. Required ${finding.required}. ${finding.recovery}`,
    },
  ];
  if (!mount.path || !mount.api) return checks;
  const adminDir = `${appDir}${mount.path}`;
  const apiDir = `${appDir}${mount.api}`;
  const page = `${adminDir}/[[...slug]]/page.tsx`;
  const problems = await cacheComponentsProblems(cwd, {
    routes: [
      `${apiDir}/[...route]/route.ts`,
      `${apiDir}/stream/route.ts`,
      `${adminDir}/not-found.tsx`,
    ],
    layout: `${adminDir}/layout.tsx`,
    page,
  });
  const pageFix = await blockingPageFix(cwd, page, configImportFor(path.dirname(page), aliasMode));
  const removals = await literalExportRemovals(cwd, [
    `${apiDir}/[...route]/route.ts`,
    `${apiDir}/stream/route.ts`,
    `${adminDir}/not-found.tsx`,
    `${adminDir}/layout.tsx`,
    ...(pageFix ? [] : [page]),
  ]);
  const fix =
    pageFix || removals.length > 0
      ? async () => [...removals, ...(pageFix ? [await pageFix()] : [])]
      : null;
  checks.push({
    name: "Admin files build under cacheComponents",
    ok: problems.length === 0,
    ...(problems.length > 0 ? { hint: problems.join("\n    ") } : {}),
    ...(fix ? { fix } : {}),
  });
  return checks;
}

/** Drops the one-line `runtime`, `dynamic`, `revalidate` and `fetchCache` exports 0.3 wrote; a file with any other form stays yours. */
async function literalExportRemovals(cwd: string, files: string[]): Promise<FileIntent[]> {
  const intents: FileIntent[] = [];
  for (const file of files) {
    const current = await fs.readFile(path.join(cwd, file), "utf8").catch(() => null);
    if (current === null || !new RegExp(REJECTED_EXPORT.source, "m").test(current)) continue;
    const content = current.replace(LITERAL_EXPORT, "");
    if (new RegExp(REJECTED_EXPORT.source, "m").test(content)) continue;
    intents.push({ path: file, content, expectedContent: current });
  }
  return intents;
}

/** Rewrites a catch-all page an earlier `init` wrote without `instant = false`; a page you edited stays yours. */
async function blockingPageFix(
  cwd: string,
  page: string,
  configImport: string,
): Promise<(() => Promise<FileIntent>) | null> {
  const current = await fs.readFile(path.join(cwd, page), "utf8").catch(() => null);
  if (current === null || BLOCKING.test(current)) return null;
  if (!(await isGeneratedAdminPage(current, configImport))) return null;
  return async () => ({
    path: page,
    content: await adminPageSource(configImport, true),
    expectedContent: current,
  });
}
