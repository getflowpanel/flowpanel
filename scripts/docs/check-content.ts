import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import {
  DOC_KINDS,
  DOC_REDIRECTS,
  validateDocRedirects,
} from "../../apps/site/src/shared/lib/docs-contract";
import { classifyCodeBlocks } from "./check-snippets";
import { docRoute, headingSlugs, lineAt, parseFrontmatter, walkFiles } from "./files";
import type { DocsProblem } from "./types";

function displayPath(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

function withoutCode(source: string): string {
  return source
    .replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, "")
    .replace(/`[^`\n]+`/g, "");
}

function checkNavigation(root: string, files: readonly string[]): DocsProblem[] {
  const problems: DocsProblem[] = [];
  for (const file of files) {
    const metaPath = join(dirname(file), "meta.json");
    const slug = basename(file, ".mdx");
    let pages: string[] = [];
    try {
      pages = (JSON.parse(readFileSync(metaPath, "utf8")) as { pages?: string[] }).pages ?? [];
    } catch {
      problems.push({
        code: "navigation-meta-missing",
        file: displayPath(root, file),
        line: 1,
        message: `Parent navigation file is missing or invalid: ${displayPath(root, metaPath)}.`,
        suggestion: "Add a valid meta.json with this page in its pages array.",
      });
      continue;
    }
    if (!pages.includes(slug)) {
      problems.push({
        code: "navigation-missing",
        file: displayPath(root, file),
        line: 1,
        message: `${slug} is not listed in its parent navigation.`,
        suggestion: `Add "${slug}" to ${displayPath(root, metaPath)}.`,
      });
    }
  }
  return problems;
}

function checkReadmeLinks(root: string): DocsProblem[] {
  const file = join(root, "README.md");
  if (!existsSync(file)) return [];
  const source = readFileSync(file, "utf8");
  const problems: DocsProblem[] = [];
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1] ?? "";
    if (/^(?:https?:|mailto:|#|\/)/.test(target)) continue;
    const clean = target.split("#", 1)[0];
    if (clean && !existsSync(resolve(dirname(file), clean))) {
      problems.push({
        code: "readme-link-missing",
        file: "README.md",
        line: lineAt(source, match.index),
        message: `README link target does not exist: ${target}.`,
        suggestion: "Fix the path or remove the stale link.",
      });
    }
  }
  return problems;
}

export function checkContent(root: string): DocsProblem[] {
  const docsRoot = join(root, "apps/site/content/docs");
  if (!existsSync(docsRoot))
    return [
      {
        code: "docs-root-missing",
        file: "apps/site/content/docs",
        line: 1,
        message: "Documentation content directory does not exist.",
      },
    ];
  const files = walkFiles(docsRoot, ".mdx");
  const pageByRoute = new Map(files.map((file) => [docRoute(file, docsRoot), file]));
  const headingByRoute = new Map(
    files.map((file) => [docRoute(file, docsRoot), headingSlugs(readFileSync(file, "utf8"))]),
  );
  const problems = [...checkNavigation(root, files), ...checkReadmeLinks(root)];
  const titles = new Map<string, string[]>();

  try {
    validateDocRedirects(DOC_REDIRECTS, new Set(pageByRoute.keys()));
  } catch (error) {
    problems.push({
      code: "redirect-invalid",
      file: "apps/site/src/shared/lib/docs-contract.ts",
      line: 1,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const display = displayPath(root, file);
    const { data, body } = parseFrontmatter(source);
    for (const key of ["title", "description"] as const) {
      if (!data[key]?.trim())
        problems.push({
          code: `frontmatter-${key}`,
          file: display,
          line: 1,
          message: `Required frontmatter field "${key}" is missing.`,
          suggestion: `Add a concise ${key}.`,
        });
    }
    if (!DOC_KINDS.includes(data.kind as (typeof DOC_KINDS)[number])) {
      problems.push({
        code: "frontmatter-kind",
        file: display,
        line: 1,
        message: `Frontmatter kind must be one of: ${DOC_KINDS.join(", ")}.`,
        suggestion: "Choose the reader intent this page serves.",
      });
    }
    if (data.title) {
      const list = titles.get(data.title) ?? [];
      list.push(display);
      titles.set(data.title, list);
    }

    const prose = withoutCode(body);
    for (const match of prose.matchAll(
      /\bflowpanel\s+(?:turns|is|ships|provides|uses|lets|helps)\b/g,
    )) {
      problems.push({
        code: "product-spelling",
        file: display,
        line: lineAt(source, source.indexOf(match[0])),
        message: "Use FlowPanel for the product name.",
        suggestion: `Replace "${match[0].split(/\s/, 1)[0]}" with "FlowPanel".`,
      });
    }

    for (const match of prose.matchAll(/\]\((\/docs\/[^)#\s]*)(?:#([^\s)]+))?\)/g)) {
      const target = (match[1] ?? "").replace(/\/$/, "");
      if (!pageByRoute.has(target)) {
        problems.push({
          code: "link-page-missing",
          file: display,
          line: lineAt(source, source.indexOf(match[0])),
          message: `Internal link points to a missing canonical page: ${target}.`,
          suggestion: "Link to a canonical page or add a checked redirect.",
        });
        continue;
      }
      const anchor = match[2];
      if (anchor && !headingByRoute.get(target)?.has(anchor)) {
        problems.push({
          code: "link-anchor-missing",
          file: display,
          line: lineAt(source, source.indexOf(match[0])),
          message: `Internal link points to a missing heading: ${target}#${anchor}.`,
          suggestion: "Update the anchor to the rendered heading slug.",
        });
      }
    }

    problems.push(...classifyCodeBlocks(source, display).problems);
    for (const match of source.matchAll(/<include(?:\s[^>]*)?>([^<]+\.(?:ts|tsx))<\/include>/g)) {
      const target = resolve(dirname(file), (match[1] ?? "").trim());
      const snippetsRoot = join(root, "apps/site/content/snippets");
      if (!target.startsWith(`${snippetsRoot}${sep}`) || !existsSync(target)) {
        problems.push({
          code: "snippet-include-invalid",
          file: display,
          line: lineAt(source, match.index),
          message: `Included TypeScript snippet is missing or outside content/snippets: ${match[1]}.`,
          suggestion: "Include a canonical compiled file from apps/site/content/snippets.",
        });
      }
    }
  }

  for (const [title, titleFiles] of titles) {
    if (titleFiles.length < 2) continue;
    for (const file of titleFiles)
      problems.push({
        code: "title-duplicate",
        file,
        line: 2,
        message: `Page title "${title}" is also used by ${titleFiles.filter((item) => item !== file).join(", ")}.`,
        suggestion: "Give each page a distinct, task-oriented title.",
      });
  }
  return problems;
}
