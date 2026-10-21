import * as path from "node:path";
import { type AdminMount, findAdminRouteConflicts } from "../utils/admin-path";
import { configImportFor, fileExists, type PathAliasMode, type PmCommands } from "../utils/detect";
import { usesCacheComponents } from "../utils/next-config";
import { configDialect, migrationTemplate } from "../utils/sql-dialect";
import type { Check } from "./check";
import { FIXABLE_FILES, MIGRATION_REL_DEST, makeFix } from "./templates";

interface RouteFileInput {
  cwd: string;
  appDir: string;
  aliasMode: PathAliasMode;
  mount: AdminMount;
  pmc: PmCommands;
}

/** One check per file init writes under the mount, each repairable with `doctor --fix` unless repairing it is unsafe. */
export async function routeFileChecks(input: RouteFileInput): Promise<Check[]> {
  const { cwd, appDir, aliasMode, mount, pmc } = input;
  const apiPath = mount.api ?? null;
  const migrationTemplateName = migrationTemplate((await configDialect(cwd)) ?? "postgresql");
  const cacheComponents = await usesCacheComponents(cwd);
  const checks: Check[] = [];
  for (const file of FIXABLE_FILES) {
    const isAdmin = file.mount === "admin";
    if (isAdmin && !mount.path) continue;
    // A configured but dynamic `paths.api` names files this run cannot know.
    if (file.mount === "api" && apiPath === null) {
      checks.push({
        name: file.label,
        ok: false,
        hint: "paths.api is not a static string; pass its resolved URL to repair it.",
      });
      continue;
    }
    const relDest =
      file.mount === null
        ? MIGRATION_REL_DEST
        : `${appDir}${isAdmin ? mount.path : apiPath}/${file.relToMount}`;
    const collisions =
      isAdmin && mount.path
        ? await findAdminRouteConflicts(
            cwd,
            appDir,
            mount.path,
            `${appDir}${mount.path}/[[...slug]]/page.tsx`,
          )
        : [];
    if (collisions.length) {
      checks.push({
        name: file.label,
        ok: false,
        hint: `Route overlaps ${collisions.join(", ")}. Choose a free mount; automatic repair is unsafe.`,
      });
      continue;
    }
    const exists = await fileExists(path.join(cwd, relDest));
    const templateName = file.mount === null ? migrationTemplateName : file.templateName;
    const configImport = file.needsConfigImport
      ? configImportFor(path.dirname(relDest), aliasMode)
      : null;
    const fix = exists
      ? {}
      : { fix: async () => [await makeFix(relDest, templateName, configImport, cacheComponents)] };
    const hint = `Run: ${pmc.exec} flowpanel doctor --fix`;
    if (file.optional) {
      checks.push({ name: file.label, ok: true, ...(exists ? {} : { warn: true, hint }), ...fix });
    } else checks.push({ name: file.label, ok: exists, hint, ...fix });
  }
  return checks;
}
