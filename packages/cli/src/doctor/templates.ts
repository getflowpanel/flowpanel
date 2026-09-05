import type { FileIntent } from "../plan/types";
import { tpl } from "../utils/template";

export const FIXABLE_FILES: ReadonlyArray<{
  relToAppDir: string | null;
  templateName: string;
  label: string;
  needsConfigImport: boolean;
}> = [
  {
    relToAppDir: "api/flowpanel/[...route]/route.ts",
    templateName: "api-route.ts.txt",
    label: "API route",
    needsConfigImport: true,
  },
  {
    relToAppDir: "api/flowpanel/stream/route.ts",
    templateName: "sse-route.ts.txt",
    label: "SSE route",
    needsConfigImport: true,
  },
  {
    relToAppDir: null,
    templateName: "migration.sql.txt",
    label: "Seed migration (flowpanel/migrations)",
    needsConfigImport: false,
  },
  {
    relToAppDir: "admin/[[...slug]]/page.tsx",
    templateName: "admin-page.tsx.txt",
    label: "Catch-all admin page",
    needsConfigImport: true,
  },
];

/** `relToAppDir === null` files (currently just the seed migration) live at a fixed repo-root path. */
export const MIGRATION_REL_DEST = "flowpanel/migrations/0001_init.sql";

export async function makeFix(
  relDest: string,
  templateName: string,
  configImport: string | null,
): Promise<FileIntent> {
  const content = configImport
    ? await tpl(templateName, { CONFIG_IMPORT: configImport })
    : await tpl(templateName);
  return { path: relDest, content };
}
