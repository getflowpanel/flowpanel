import type { ReactNode } from "react";

/**
 * Tiny TypeScript highlighter for the landing's static snippets.
 *
 * Server-rendered to spans keyed to the `--code-*` theme tokens — zero client
 * JS and no syntax-highlighting dependency for a handful of marketing examples.
 * Scoped to the constructs those snippets use; it is NOT a general tokenizer.
 */

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "const",
  "let",
  "var",
  "return",
  "new",
  "async",
  "await",
  "function",
  "type",
  "interface",
  "extends",
  "as",
  "void",
  "declare",
]);

const LITERALS = new Set(["true", "false", "null", "undefined", "this"]);

const RULES: ReadonlyArray<{ type: string; re: RegExp }> = [
  { type: "comment", re: /^\/\/[^\n]*/ },
  { type: "comment", re: /^\/\*[\s\S]*?\*\// },
  { type: "string", re: /^`(?:\\.|[^`\\])*`/ },
  { type: "string", re: /^"(?:\\.|[^"\\])*"/ },
  { type: "string", re: /^'(?:\\.|[^'\\])*'/ },
  { type: "number", re: /^\d[\d_]*(?:\.\d+)?/ },
  { type: "word", re: /^[A-Za-z_$][\w$]*/ },
  { type: "punct", re: /^[{}[\]()<>.,;:?!=+\-*/%&|@]+/ },
  { type: "space", re: /^\s+/ },
];

const CLASS: Record<string, string> = {
  comment: "text-[var(--code-comment)] italic",
  string: "text-[var(--code-str)]",
  number: "text-[var(--code-num)]",
  keyword: "text-[var(--code-kw)]",
  fn: "text-[var(--code-fn)]",
  punct: "text-[var(--code-punct)]",
};

export function highlightTs(code: string): ReactNode {
  const out: ReactNode[] = [];
  let rest = code;
  let key = 0;

  while (rest.length > 0) {
    let matched = false;

    for (const { type, re } of RULES) {
      const m = re.exec(rest);
      if (!m) continue;

      const value = m[0];
      let cls: string | undefined;

      if (type === "word") {
        if (KEYWORDS.has(value) || LITERALS.has(value)) cls = CLASS.keyword;
        else if (/^\s*\(/.test(rest.slice(value.length))) cls = CLASS.fn;
      } else if (type !== "space") {
        cls = CLASS[type];
      }

      out.push(
        cls ? (
          <span key={key} className={cls}>
            {value}
          </span>
        ) : (
          value
        ),
      );
      rest = rest.slice(value.length);
      key += 1;
      matched = true;
      break;
    }

    if (!matched) {
      out.push(rest[0]);
      rest = rest.slice(1);
      key += 1;
    }
  }

  return out;
}
