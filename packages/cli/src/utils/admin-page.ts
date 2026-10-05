import { blockingSegmentExport } from "./next-config";
import { tpl } from "./template";

const METADATA_EXPORT = "export const generateMetadata = flowpanel.metadata;\n";
const BLOCKING_EXPORT = blockingSegmentExport(true);

/** The catch-all admin page `init` writes and `doctor --fix` restores. */
export function adminPageSource(configImport: string, cacheComponents: boolean): Promise<string> {
  return tpl("admin-page.tsx.txt", {
    CONFIG_IMPORT: configImport,
    SEGMENT_CONFIG: blockingSegmentExport(cacheComponents),
  });
}

/** True when `source` is a catch-all page some `init` wrote, with or without its metadata and `instant` lines. */
export async function isGeneratedAdminPage(source: string, configImport: string): Promise<boolean> {
  const bare = (await adminPageSource(configImport, false)).replace(METADATA_EXPORT, "");
  return source.replace(BLOCKING_EXPORT, "").replace(METADATA_EXPORT, "") === bare;
}
