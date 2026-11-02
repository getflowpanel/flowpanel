import { join } from "node:path";
import { checkApi } from "./check-api";
import { checkCli } from "./check-cli";
import { checkContent } from "./check-content";
import { checkOptions } from "./check-options";
import { checkUpgradeGuide } from "./check-upgrade";
import { walkFiles } from "./files";
import { checkInitSnippets } from "./generate-init-snippets";
import { checkLlms, expansionContext } from "./generate-llms";
import { checkLlmsTopics } from "./generate-llms-topics";
import type { DocsProblem } from "./types";

export interface DocsReport {
  problems: DocsProblem[];
  pages: number;
}

export async function runDocsChecks(root: string): Promise<DocsReport> {
  const llms = expansionContext(root);
  const problems = [
    ...checkContent(root),
    ...checkApi(root),
    ...checkCli(root),
    ...checkOptions(root),
    ...checkUpgradeGuide(root),
    ...checkLlms(root, llms),
    ...checkLlmsTopics(root, llms),
    ...(await checkInitSnippets()),
  ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));
  return {
    problems,
    pages: walkFiles(join(root, "apps/site/content/docs"), ".mdx").length,
  };
}
