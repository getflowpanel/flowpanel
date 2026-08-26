import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDocsChecks } from "./docs/checks";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function main(): Promise<void> {
  const report = await runDocsChecks(root);

  if (report.problems.length > 0) {
    console.error(`✗ ${report.problems.length} documentation problem(s):\n`);
    for (const problem of report.problems) {
      console.error(`  ${problem.file}:${problem.line} [${problem.code}] ${problem.message}`);
      if (problem.suggestion) console.error(`    → ${problem.suggestion}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `✔ documentation verified — ${report.pages} canonical pages; content, API, CLI, defaults, compatibility, and links agree`,
    );
  }
}

void main();
