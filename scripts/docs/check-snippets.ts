import type { DocsProblem } from "./types";

export type CodeBlockKind = "checked" | "fragment" | "include";

/** What a `fragment` fence may stand for without a written reason. */
export const FRAGMENT_KINDS = ["option", "diff", "signature", "pseudo"] as const;

export interface ClassifiedCodeBlock {
  kind: CodeBlockKind;
  language: "ts" | "tsx";
  /** Line of the opening fence, or of the `<include>`. */
  line: number;
  /** The block's code, its indentation removed; absent for an include. */
  code?: string;
  /** Why a fragment does not compile on its own. */
  reason?: string;
  /** `as="AdminConfig"`: the type the block's object or properties are checked against. */
  as?: string;
  /** `of="@flowpanel/kit/next"`: the module whose exports the block's signatures and types must match. */
  of?: string;
  /** The `<AdapterTab>` the block sits in. */
  adapter?: "drizzle" | "prisma";
  source?: string;
}

export interface CodeBlockClassification {
  blocks: ClassifiedCodeBlock[];
  problems: DocsProblem[];
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

/** The reason a `fragment` fence gives; `null` when it gives none, `undefined` when the fence is no fragment. */
function fragmentReason(meta: string): string | null | undefined {
  const match = /(?:^|\s)fragment(?:=(?:"([^"]*)"|(\S+)))?(?=\s|$)/.exec(meta);
  if (!match) return undefined;
  if (match[2] !== undefined) {
    return (FRAGMENT_KINDS as readonly string[]).includes(match[2]) ? match[2] : null;
  }
  const reason = (match[1] ?? "").trim();
  return reason.split(/\s+/).length >= 2 ? reason : null;
}

/**
 * Every TypeScript example on a page: checked code (the default, `as="Type"` for an option
 * shown on its own, `of="module"` for signatures of a module's exports), a `fragment` that
 * names why it does not compile alone, or an `<include>`.
 */
export function classifyCodeBlocks(source: string, file: string): CodeBlockClassification {
  const blocks: ClassifiedCodeBlock[] = [];
  const problems: DocsProblem[] = [];
  const lines = source.split("\n");

  let adapter: "drizzle" | "prisma" | undefined;
  for (let index = 0; index < lines.length; index++) {
    const tab = /<AdapterTab adapter="(drizzle|prisma)"/.exec(lines[index] ?? "");
    if (tab) adapter = tab[1] === "prisma" ? "prisma" : "drizzle";
    if (/<\/AdapterTab>/.test(lines[index] ?? "")) adapter = undefined;
    const open = /^([ \t]*)```(ts|tsx)(?=\s|$)(.*)$/.exec(lines[index] ?? "");
    if (!open) continue;
    const indent = open[1] ?? "";
    const language = open[2] === "tsx" ? "tsx" : "ts";
    const meta = open[3]?.trim() ?? "";
    const line = index + 1;
    const body: string[] = [];
    for (index++; index < lines.length && !/^[ \t]*```\s*$/.test(lines[index] ?? ""); index++) {
      const text = lines[index] ?? "";
      body.push(text.startsWith(indent) ? text.slice(indent.length) : text.trimStart());
    }
    const code = `${body.join("\n")}\n`;
    const reason = fragmentReason(meta);
    const as = /(?:^|\s)as="([^"]+)"/.exec(meta)?.[1];
    const of = /(?:^|\s)of="([^"]+)"/.exec(meta)?.[1];
    if (reason === undefined) {
      blocks.push({
        kind: "checked",
        language,
        line,
        code,
        ...(as ? { as } : {}),
        ...(of ? { of } : {}),
        ...(adapter ? { adapter } : {}),
      });
    } else if (reason === null) {
      problems.push({
        code: "snippet-fragment-reason",
        file,
        line,
        message: "A fragment fence must say why its code does not compile on its own.",
        suggestion: `Write fragment="<short reason>" or fragment=<${FRAGMENT_KINDS.join("|")}>, or make the block compile.`,
      });
    } else {
      blocks.push({
        kind: "fragment",
        language,
        line,
        code,
        reason,
        ...(adapter ? { adapter } : {}),
      });
    }
  }

  for (const match of source.matchAll(/<include(?:\s[^>]*)?>([^<]+\.(tsx?))<\/include>/g)) {
    blocks.push({
      kind: "include",
      language: match[2] === "tsx" ? "tsx" : "ts",
      line: lineAt(source, match.index),
      source: (match[1] ?? "").trim(),
    });
  }

  return { blocks, problems };
}
