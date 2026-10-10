import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCES = ["packages/react/src", "packages/next/src", "packages/charts/src"];

/** Screens a developer sees while wiring the admin, linking English docs; never shown to an operator. */
const DEVELOPER_ONLY = new Set([
  "packages/react/src/devtools/DevToolsPanel.tsx",
  "packages/next/src/pages/welcome.tsx",
  "packages/next/src/runtime/dev-auth-note.tsx",
]);

const ATTRIBUTE = /\b(aria-label|aria-description|placeholder|title|alt)=["'][^"'{]*[A-Za-z]{2}/;
const TEXT_LINE = /^\s*[A-Z][a-z]+(?:[ ,][A-Za-z]+)*[.…!?]?\s*$/;
const INLINE_TEXT = />\s*[A-Z][a-z]+(?: [A-Za-z]+)*[.…]?\s*<\//;
const TEMPLATE_ATTRIBUTE = /\b(?:aria-label|aria-description|placeholder|title|alt)=\{`([^`]*)`\}/;
const WORD_CHOICE = /\?\s*["'`][A-Z][a-z]+["'`]\s*:\s*["'`][A-Z][a-z]+["'`]/;
const MESSAGE = /\bok:\s*true,\s*message:\s*["'`]/;
const HELPER_RETURN = /\breturn\s+["'`][A-Z][a-z]+/;
const HELPER_FILE = /cell|format/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [rel] : [];
  });
}

function templateText(line: string): boolean {
  const literal = TEMPLATE_ATTRIBUTE.exec(line)?.[1];
  return literal !== undefined && /[A-Za-z]{2}/.test(literal.replace(/\$\{[^}]*\}/g, ""));
}

function englishLiteral(file: string, line: string): boolean {
  if (WORD_CHOICE.test(line) || MESSAGE.test(line)) return true;
  if (HELPER_FILE.test(path.basename(file)) && HELPER_RETURN.test(line)) return true;
  if (!file.endsWith(".tsx")) return false;
  return (
    ATTRIBUTE.test(line) || TEXT_LINE.test(line) || INLINE_TEXT.test(line) || templateText(line)
  );
}

describe("UI source", () => {
  it("prints no English literal where a label belongs", () => {
    const found: string[] = [];
    for (const file of SOURCES.flatMap(sourceFiles)) {
      if (DEVELOPER_ONLY.has(file)) continue;
      const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n");
      let inComment = false;
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("/*")) inComment = !trimmed.includes("*/");
        else if (inComment && trimmed.includes("*/")) inComment = false;
        if (inComment || trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (englishLiteral(file, line)) {
          found.push(`${file}:${index + 1}: ${trimmed}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it("catches the shapes a hard-coded string takes", () => {
    const slot = (name: string) => `$\{${name}}`;
    expect(englishLiteral("a/ArrayCell.tsx", `aria-label={\`${slot("n")} items\`}`)).toBe(true);
    expect(englishLiteral("a/ArrayCell.tsx", `aria-label={\`${slot("label")}\`}`)).toBe(false);
    expect(englishLiteral("a/x.ts", 'return v ? "Yes" : "No";')).toBe(true);
    const reply = `Response.json({ ok: true, message: \`Deleted ${slot("n")}\` })`;
    expect(englishLiteral("a/x.ts", reply)).toBe(true);
    expect(englishLiteral("a/format-cell.tsx", 'return "Never";')).toBe(true);
    expect(englishLiteral("a/x.ts", 'return "Never";')).toBe(false);
  });
});
