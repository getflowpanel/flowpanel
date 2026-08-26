import type { DocsProblem } from "./types";

export type CodeBlockKind = "twoslash" | "excerpt" | "include";

export interface ClassifiedCodeBlock {
  kind: CodeBlockKind;
  language: "ts" | "tsx";
  line: number;
  source?: string;
}

export interface CodeBlockClassification {
  blocks: ClassifiedCodeBlock[];
  problems: DocsProblem[];
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

export function classifyCodeBlocks(source: string, file: string): CodeBlockClassification {
  const blocks: ClassifiedCodeBlock[] = [];
  const problems: DocsProblem[] = [];

  for (const match of source.matchAll(/^[ \t]*```(ts|tsx)\b([^\n]*)$/gm)) {
    const language = match[1] as "ts" | "tsx";
    const meta = match[2]?.trim().split(/\s+/) ?? [];
    const line = lineAt(source, match.index);
    if (meta.includes("twoslash")) {
      blocks.push({ kind: "twoslash", language, line });
      continue;
    }
    if (meta.includes("excerpt")) {
      blocks.push({ kind: "excerpt", language, line });
      continue;
    }
    problems.push({
      code: "snippet-unclassified",
      file,
      line,
      message: "TypeScript example is not classified as checked code or an explanatory excerpt.",
      suggestion:
        "Add `twoslash` for inline checked code, `excerpt` for a partial shape, or render a compiled file with `<include>`.",
    });
  }

  for (const match of source.matchAll(/<include(?:\s[^>]*)?>([^<]+\.(tsx?))<\/include>/g)) {
    blocks.push({
      kind: "include",
      language: match[2] as "ts" | "tsx",
      line: lineAt(source, match.index),
      source: match[1].trim(),
    });
  }

  return { blocks, problems };
}
