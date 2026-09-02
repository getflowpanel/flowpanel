import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createProgram } from "../../packages/cli/src/program";
import { buildCliReference, type CliCommandDoc } from "./cli-metadata";
import { lineAt } from "./files";
import type { DocsProblem } from "./types";

export function checkCli(root: string): DocsProblem[] {
  const file = join(root, "apps/site/content/docs/reference/cli.mdx");
  if (!existsSync(file))
    return [
      {
        code: "cli-page-missing",
        file: "apps/site/content/docs/reference/cli.mdx",
        line: 1,
        message: "Canonical CLI reference page is missing.",
      },
    ];
  const source = readFileSync(file, "utf8");
  const docs = buildCliReference(createProgram());
  const valid = new Set(docs.slice(1).map((command) => command.name));
  const problems: DocsProblem[] = [];
  const used = new Set<string>();

  if (!/<CliReference\s*\/>/.test(source))
    problems.push({
      code: "cli-root-reference-missing",
      file: "apps/site/content/docs/reference/cli.mdx",
      line: 1,
      message: "CLI page does not render the generated root command list.",
      suggestion: "Add <CliReference />.",
    });
  for (const match of source.matchAll(/<CliReference\s+command="([^"]+)"\s*\/>/g)) {
    const name = match[1] ?? "";
    used.add(name);
    if (!valid.has(name))
      problems.push({
        code: "cli-command-unknown",
        file: "apps/site/content/docs/reference/cli.mdx",
        line: lineAt(source, match.index),
        message: `Generated CLI reference names unknown command "${name}".`,
        suggestion: `Use one of: ${[...valid].join(", ")}.`,
      });
  }
  for (const name of valid) {
    if (!used.has(name))
      problems.push({
        code: "cli-command-reference-missing",
        file: "apps/site/content/docs/reference/cli.mdx",
        line: 1,
        message: `CLI command ${name} has no generated reference block.`,
        suggestion: `Add <CliReference command="${name}" /> near its explanation.`,
      });
  }

  const generatedFile = join(root, "apps/site/src/generated/cli-reference.json");
  if (!existsSync(generatedFile)) {
    problems.push({
      code: "cli-metadata-missing",
      file: "apps/site/src/generated/cli-reference.json",
      line: 1,
      message: "Generated CLI metadata is missing.",
      suggestion: "Run pnpm docs:generate.",
    });
  } else {
    const generated = JSON.parse(readFileSync(generatedFile, "utf8")) as CliCommandDoc[];
    if (JSON.stringify(generated) !== JSON.stringify(docs)) {
      problems.push({
        code: "cli-metadata-stale",
        file: "apps/site/src/generated/cli-reference.json",
        line: 1,
        message: "Generated CLI metadata does not match Commander.",
        suggestion: "Run pnpm docs:generate.",
      });
    }
  }

  const program = createProgram();
  const commands = [program, ...program.commands];
  for (const [index, commandDoc] of docs.entries()) {
    const help = commands[index]?.helpInformation() ?? "";
    for (const option of commandDoc.options) {
      if (!help.includes(option.flags))
        problems.push({
          code: "cli-metadata-drift",
          file: "packages/cli/src/program.ts",
          line: 1,
          message: `${commandDoc.name} metadata option ${option.flags} is absent from Commander help.`,
          suggestion: "Read flags only from the matching Commander command.",
        });
    }
  }
  return problems;
}
