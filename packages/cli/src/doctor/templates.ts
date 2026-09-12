import type { FileIntent } from "../plan/types";
import { tpl } from "../utils/template";

export interface FixableFile {
  /** `"admin"` and `"api"` follow the configured mount; `null` is a repo-root path. */
  mount: "admin" | "api" | null;
  /** Appended to the configured mount, for the two route handlers. */
  relToMount: string;
  templateName: string;
  label: string;
  needsConfigImport: boolean;
}

export const FIXABLE_FILES: ReadonlyArray<FixableFile> = [
  {
    mount: "api",
    relToMount: "[...route]/route.ts",
    templateName: "api-route.ts.txt",
    label: "API route",
    needsConfigImport: true,
  },
  {
    mount: "api",
    relToMount: "stream/route.ts",
    templateName: "sse-route.ts.txt",
    label: "SSE route",
    needsConfigImport: true,
  },
  {
    mount: null,
    relToMount: "",
    templateName: "migration.sql.txt",
    label: "Seed migration (flowpanel/migrations)",
    needsConfigImport: false,
  },
  {
    mount: "admin",
    relToMount: "[[...slug]]/page.tsx",
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
