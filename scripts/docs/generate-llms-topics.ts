import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { siteConfig } from "../../apps/site/src/shared/lib/site-config";
import {
  type DocsPage,
  type ExpansionContext,
  expansionContext,
  header,
  normalize,
  readPages,
  renderPage,
  unexpanded,
} from "./generate-llms";
import type { DocsProblem } from "./types";

export const LLMS_TOPICS_DIR = "packages/flowpanel/llms";

/** A section whose text runs longer than this is written one page per file. */
export const LLMS_TOPIC_MAX_LINES = 1000;

const DOCS_ROOT = "apps/site/content/docs";

interface Meta {
  title?: string;
  pages?: string[];
}

function readMeta(file: string): Meta {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Meta) : {};
}

function sections(root: string): Array<{ slug: string; title: string }> {
  const docs = join(root, DOCS_ROOT);
  return (readMeta(join(docs, "meta.json")).pages ?? [])
    .filter((slug) => existsSync(join(docs, slug, "meta.json")))
    .map((slug) => ({ slug, title: readMeta(join(docs, slug, "meta.json")).title ?? slug }));
}

function topicText(title: string, pages: readonly DocsPage[]): string {
  const body = [`# ${siteConfig.name} — ${title}`, "", ...pages.map(renderPage)].join("\n");
  return `${body.trimEnd()}\n`;
}

function pageFile(page: DocsPage): string {
  return page.route
    .replace(/^\/docs\//, "")
    .split("/")
    .join("-");
}

function pageParts(page: DocsPage, maxLines: number): string[][] {
  const blocks: string[][] = [];
  for (const line of renderPage(page).trimEnd().split("\n")) {
    if (line.startsWith("### ") || blocks.length === 0) blocks.push([]);
    blocks.at(-1)?.push(line);
  }
  const parts: string[][] = [];
  for (const block of blocks) {
    const last = parts.at(-1);
    if (last && last.length + block.length + 2 <= maxLines) last.push(...block);
    else parts.push([...block]);
  }
  return parts;
}

function partTitles(lines: readonly string[]): string {
  return lines
    .filter((line) => line.startsWith("### "))
    .map((line) => line.slice(4))
    .join(", ");
}

/**
 * The docs one section per file — or one page per file for a section longer than `maxLines`, and
 * a page longer than that in parts split at its sections — and `index.txt` naming each.
 */
export function generateLlmsTopics(
  root: string,
  maxLines = LLMS_TOPIC_MAX_LINES,
  context: ExpansionContext = expansionContext(root),
): Map<string, string> {
  const files = new Map<string, string>();
  const index = [
    header(root, "every section of the documentation").trimEnd(),
    "",
    "## Topics",
    "",
    `One file per section of the documentation, or per page of a section longer than ${maxLines} lines, or per part of such a page.`,
    `This directory is canonical; ${siteConfig.url}/llms/<file> serves the same files.`,
    "",
  ];
  for (const { slug, title } of sections(root)) {
    const pages = readPages(root, slug, context);
    if (pages.length === 0) continue;
    const whole = topicText(title, pages);
    if (whole.split("\n").length <= maxLines) {
      files.set(`${slug}.txt`, whole);
      index.push(`- llms/${slug}.txt — ${title}: ${pages.map((page) => page.title).join(", ")}`);
      continue;
    }
    for (const page of pages) {
      const name = pageFile(page);
      const text = topicText(`${title} — ${page.title}`, [page]);
      if (text.split("\n").length <= maxLines) {
        files.set(`${name}.txt`, text);
        const about = page.description ? `. ${page.description}` : "";
        index.push(`- llms/${name}.txt — ${title}: ${page.title}${about}`);
        continue;
      }
      pageParts(page, maxLines).forEach((lines, at) => {
        const file = `${name}-${at + 1}.txt`;
        const heading = `# ${siteConfig.name} — ${title} — ${page.title} (part ${at + 1})`;
        files.set(file, `${[heading, "", ...lines].join("\n").trimEnd()}\n`);
        index.push(`- llms/${file} — ${title}: ${page.title}, ${partTitles(lines) || "overview"}`);
      });
    }
  }
  files.set("index.txt", `${index.join("\n")}\n`);
  return files;
}

export function checkLlmsTopics(root: string, context?: ExpansionContext): DocsProblem[] {
  const expected = generateLlmsTopics(root, LLMS_TOPIC_MAX_LINES, context);
  const directory = join(root, LLMS_TOPICS_DIR);
  const stale = [...expected]
    .filter(([file, text]) => {
      const path = join(directory, file);
      return !existsSync(path) || normalize(readFileSync(path, "utf8")) !== normalize(text);
    })
    .map(([file]) => file);
  const leftover = existsSync(directory)
    ? readdirSync(directory).filter((file) => !expected.has(file))
    : [];
  const raw = [...expected].flatMap(([file, text]) =>
    unexpanded(`${LLMS_TOPICS_DIR}/${file}`, text),
  );
  return [
    ...raw,
    ...[...stale, ...leftover].map((file) => ({
      code: "llms-topics-stale",
      file: `${LLMS_TOPICS_DIR}/${file}`,
      line: 1,
      message: `${LLMS_TOPICS_DIR}/${file} no longer matches the documentation.`,
      suggestion: "Run pnpm docs:llms.",
    })),
  ];
}
