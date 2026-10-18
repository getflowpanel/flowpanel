export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string; at: number }
  | { kind: "strong"; text: string; at: number }
  | { kind: "em"; text: string; at: number }
  | { kind: "link"; label: string; href: string; at: number };

const WORD = /[A-Za-z0-9_]/;
const SPACE = /\s/;

const isWord = (ch: string | undefined): boolean => ch !== undefined && WORD.test(ch);
const isSpace = (ch: string | undefined): boolean => ch !== undefined && SPACE.test(ch);

/** `indexOf` that remembers its last answer, so a scan that only moves forward stays linear. */
function nextOf(text: string) {
  const last = new Map<string, number>();
  return (ch: string, from: number): number => {
    const known = last.get(ch);
    if (known !== undefined && (known === -1 || known >= from)) return known;
    const found = text.indexOf(ch, from);
    last.set(ch, found);
    return found;
  };
}

/** The end of a link target starting at `from`: one level of parentheses, no spaces; -1 when it does not close. */
function targetEnd(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ")") return i > from ? i : -1;
    if (ch === undefined || isSpace(ch)) return -1;
    if (ch === "(") {
      let j = i + 1;
      while (j < text.length && text[j] !== ")" && text[j] !== "(" && !isSpace(text[j])) j++;
      if (text[j] !== ")") return -1;
      i = j + 1;
      continue;
    }
    i++;
  }
  return -1;
}

/** Inline markdown in one pass: code, `**strong**`, `*em*` or `_em_` between word boundaries, and `[label](target)`. */
export function inlineTokens(text: string): InlineToken[] {
  const next = nextOf(text);
  const targets = new Map<number, number>();
  const out: InlineToken[] = [];
  let plain = 0;
  let i = 0;
  const emit = (token: InlineToken, end: number): void => {
    if (i > plain) out.push({ kind: "text", text: text.slice(plain, i) });
    out.push(token);
    plain = end;
    i = end;
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\x60") {
      const close = next("\x60", i + 1);
      if (close > i + 1) {
        emit({ kind: "code", text: text.slice(i + 1, close), at: i }, close + 1);
        continue;
      }
    } else if (ch === "*" || ch === "_") {
      const bold = ch === "*" && text[i + 1] === "*";
      const width = bold ? 2 : 1;
      const start = i + width;
      const close = next(ch, start);
      const after = close + width;
      const opens =
        !isWord(text[i - 1]) && text[i - 1] !== ch && start < text.length && !isSpace(text[start]);
      const closes =
        close > start &&
        !isSpace(text[close - 1]) &&
        (!bold || text[close + 1] === "*") &&
        !isWord(text[after]) &&
        text[after] !== ch;
      if (text[start] !== ch && opens && closes) {
        const inner = text.slice(start, close);
        emit(
          bold ? { kind: "strong", text: inner, at: i } : { kind: "em", text: inner, at: i },
          after,
        );
        continue;
      }
    } else if (ch === "[") {
      const close = next("]", i + 1);
      if (close > i + 1 && text[close + 1] === "(") {
        let end = targets.get(close);
        if (end === undefined) {
          end = targetEnd(text, close + 2);
          targets.set(close, end);
        }
        if (end !== -1) {
          const token = { kind: "link" as const, label: text.slice(i + 1, close), at: i };
          emit({ ...token, href: text.slice(close + 2, end) }, end + 1);
          continue;
        }
      }
    }
    i++;
  }
  if (plain < text.length) out.push({ kind: "text", text: text.slice(plain) });
  return out;
}
