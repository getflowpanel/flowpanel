import { join } from "node:path";
import { checkApi } from "./check-api";
import { checkCli } from "./check-cli";
import { checkContent } from "./check-content";
import { checkOptions } from "./check-options";
import { walkFiles } from "./files";
import { checkLlms } from "./generate-llms";
import type { DocsProblem } from "./types";

export interface DocsReport {
  problems: DocsProblem[];
  pages: number;
}

export async function runDocsChecks(root: string): Promise<DocsReport> {
  const problems = [
    ...checkContent(root),
    ...checkApi(root),
    ...checkCli(root),
    ...checkOptions(root),
    ...checkLlms(root),
  ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));
  return {
    problems,
    pages: walkFiles(join(root, "apps/site/content/docs"), ".mdx").length,
  };
}
