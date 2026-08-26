import { join } from "node:path";
import { checkApi } from "./check-api";
import { checkCli } from "./check-cli";
import { checkContent } from "./check-content";
import { walkFiles } from "./files";
import type { DocsProblem } from "./types";

export interface DocsReport {
  problems: DocsProblem[];
  pages: number;
}

export async function runDocsChecks(root: string): Promise<DocsReport> {
  const problems = [...checkContent(root), ...checkApi(root), ...checkCli(root)].sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code),
  );
  return {
    problems,
    pages: walkFiles(join(root, "apps/site/content/docs"), ".mdx").length,
  };
}
