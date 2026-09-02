import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface FrontmatterResult {
  data: Record<string, string>;
  body: string;
  bodyOffset: number;
}

function slash(path: string): string {
  return path.replaceAll("\\", "/");
}

export function walkFiles(directory: string, extension: string): string[] {
  const output: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith(extension)) output.push(absolute);
    }
  };
  visit(directory);
  return output;
}

export function readTextFiles(directory: string, extension: string): Map<string, string> {
  return new Map(walkFiles(directory, extension).map((file) => [file, readFileSync(file, "utf8")]));
}

export function docRoute(file: string, docsRoot: string): `/docs${string}` {
  const normalizedFile = slash(file);
  const normalizedRoot = slash(docsRoot).replace(/\/$/, "");
  const prefix = `${normalizedRoot}/`;
  const relative = normalizedFile.startsWith(prefix)
    ? normalizedFile.slice(prefix.length)
    : normalizedFile;
  const page = relative.replace(/\.mdx$/, "").replace(/(?:^|\/)index$/, "");
  return `/docs${page ? `/${page}` : ""}`;
}

export function parseFrontmatter(source: string): FrontmatterResult {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return { data: {}, body: source, bodyOffset: 0 };
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { data: {}, body: source, bodyOffset: 0 };
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const item = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (!item) continue;
    const value = item[2] ?? "";
    data[item[1] as string] = value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
  return { data, body: source.slice(match[0].length), bodyOffset: match[0].length };
}

function stripFencedCode(source: string): string {
  return source.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
}

function baseSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function headingSlugs(source: string): Set<string> {
  const output = new Set<string>();
  const counts = new Map<string, number>();
  for (const match of stripFencedCode(source).matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)) {
    const base = baseSlug(match[1] ?? "");
    if (!base) continue;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    output.add(count === 0 ? base : `${base}-${count}`);
  }
  return output;
}

export function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}
