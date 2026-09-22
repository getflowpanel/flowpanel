import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Project } from "ts-morph";
import { siteConfig } from "../../apps/site/src/shared/lib/site-config";
import { createProgram } from "../../packages/cli/src/program";
import { buildCliReference, type CliCommandDoc } from "./cli-metadata";
import { docRoute, parseFrontmatter, walkFiles } from "./files";
import { createTypeProject, renderTypeTable } from "./type-table";
import type { DocsProblem } from "./types";

export const LLMS_FILE = "packages/flowpanel/llms.txt";

const DOCS_ROOT = "apps/site/content/docs";
const INSTALL = ["pnpm dlx @flowpanel/cli init", "pnpm flowpanel migrate", "pnpm flowpanel dev"];
const FENCE = /^[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
const CODE_SPAN = /(`+)(?:(?!\1)[\s\S])+?\1/g;
const IMPORT_STATEMENT =
  /^(?:import|export)\s[^\n]*\bfrom\s+["'][^"']+["'];?[ \t]*$|^import\s+["'][^"']+["'];?[ \t]*$/;
const HOLD = "@@flowpanel-block-";
const HOLD_PATTERN = /@@flowpanel-block-(\d+)@@/g;
const TYPED_COMPONENT = /<(?:AutoTypeTable|ApiSignature)\b[^<>]*?\bname="([^"]+)"[^<>]*?\/>/g;
const TYPE_TABLE = /<AutoTypeTable\b([^<>]*?)\/>/g;
const CLI_REFERENCE = /<CliReference\b([^<>]*?)\/>/g;
const ATTRIBUTE = /([A-Za-z][\w-]*)="([^"]*)"/g;

interface DocsPage {
  title: string;
  description: string;
  route: string;
  body: string;
  types: string[];
}

function fenceLanguage(line: string): string {
  const match = /^([ \t]*)(```+|~~~+)[ \t]*([A-Za-z0-9]+)?([^\n]*)$/.exec(line);
  if (!match) return line;
  const marker = /\b(twoslash|excerpt)\b/.exec(match[4] ?? "")?.[1];
  return `${match[1] ?? ""}${match[2]}${match[3] ?? ""}${marker ? ` ${marker}` : ""}`;
}

function normalizeFences(block: string): string {
  const lines = block.split("\n");
  const first = lines[0];
  return first === undefined ? block : [fenceLanguage(first), ...lines.slice(1)].join("\n");
}

function stripComponents(prose: string): string {
  const closed = new Set(
    [...prose.matchAll(/<\/([A-Z][A-Za-z0-9]*)>/g)].map((match) => match[1] as string),
  );
  let output = prose.replace(/<[A-Z][A-Za-z0-9]*(?:\s[^<>\n]*?)?\/>/g, "");
  for (const name of closed) {
    output = output
      .replace(new RegExp(`<${name}(?:\\s[^<>\\n]*?)?>`, "g"), "")
      .replace(new RegExp(`</${name}>`, "g"), "");
  }
  return output.replace(/<[A-Z][A-Za-z0-9]*\s[^<>\n]*>/g, "");
}

function demoteHeadings(prose: string): string {
  return prose.replace(/^(#{1,6})([ \t]+)/gm, (_match, hashes: string, space: string) =>
    hashes.length < 6 ? `#${hashes}${space}` : `${hashes}${space}`,
  );
}

function stripProse(prose: string): string {
  const kept = prose
    .split("\n")
    .filter((line) => !IMPORT_STATEMENT.test(line))
    .join("\n");
  return demoteHeadings(stripComponents(kept));
}

export interface ExpansionContext {
  siteRoot: string;
  project: Project;
  cli: CliCommandDoc[];
}

function attributes(source: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) found[match[1] as string] = match[2] as string;
  return found;
}

function renderCliCommand(command: CliCommandDoc): string {
  const lines = [`\`${command.usage}\` — ${command.description}`];
  for (const argument of command.arguments) {
    lines.push(`- \`${argument.syntax}\` ${argument.description}`.trimEnd());
  }
  for (const option of command.options) {
    const fallback = option.defaultValue ? ` Default: \`${option.defaultValue}\`.` : "";
    lines.push(`- \`${option.flags}\` ${option.description}${fallback}`.trimEnd());
  }
  return lines.join("\n");
}

function renderCliReference(cli: CliCommandDoc[], name: string | undefined): string {
  const commands = name ? cli.filter((command) => command.name === name) : cli;
  return commands.map(renderCliCommand).join("\n\n");
}

function expandComponents(
  masked: string,
  context: ExpansionContext | undefined,
  hold: (text: string) => string,
): string {
  if (!context) return masked;
  return masked
    .replace(TYPE_TABLE, (_match, attrs: string) => {
      const { path, name } = attributes(attrs);
      if (!path || !name) return "";
      return hold(renderTypeTable(context.project, context.siteRoot, path, name));
    })
    .replace(CLI_REFERENCE, (_match, attrs: string) =>
      hold(renderCliReference(context.cli, attributes(attrs).command)),
    );
}

export function stripMdx(
  body: string,
  context?: ExpansionContext,
): { text: string; types: string[] } {
  const blocks: string[] = [];
  const hold = (text: string): string => `${HOLD}${blocks.push(text) - 1}@@`;
  const held = body
    .replace(FENCE, (block) => hold(normalizeFences(block)))
    .replace(CODE_SPAN, (span) => hold(span));
  const types = [...held.matchAll(TYPED_COMPONENT)].map((match) => match[1] as string);
  const masked = expandComponents(held, context, hold);
  const restore = (text: string): string =>
    text.replace(HOLD_PATTERN, (_match, index: string) => blocks[Number(index)] as string);
  const text = restore(restore(stripProse(masked)))
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, types: [...new Set(types)] };
}

function pageOrder(directory: string): string[] {
  const meta = join(directory, "meta.json");
  if (!existsSync(meta)) return [];
  const parsed: unknown = JSON.parse(readFileSync(meta, "utf8"));
  const pages =
    parsed && typeof parsed === "object" ? (parsed as { pages?: unknown }).pages : undefined;
  return Array.isArray(pages)
    ? pages.filter((page): page is string => typeof page === "string")
    : [];
}

function readPages(root: string, section: string, context: ExpansionContext): DocsPage[] {
  const directory = join(root, DOCS_ROOT, section);
  if (!existsSync(directory)) return [];
  const order = pageOrder(directory);
  const files = walkFiles(directory, ".mdx").sort((a, b) => {
    const rank = (file: string): number => {
      const index = order.indexOf(basename(file, ".mdx"));
      return index < 0 ? order.length : index;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return files.map((file) => {
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    const { text, types } = stripMdx(body, context);
    return {
      title: data.title ?? basename(file, ".mdx"),
      description: data.description ?? "",
      route: docRoute(file, join(root, DOCS_ROOT)),
      body: text,
      types,
    };
  });
}

function renderPage(page: DocsPage): string {
  const lines = [`## ${page.title}`, ""];
  if (page.description) lines.push(page.description, "");
  lines.push(`Docs: ${siteConfig.url}${page.route}`, "");
  if (page.types.length > 0) lines.push(`Documented types: ${page.types.join(", ")}`, "");
  lines.push(page.body, "");
  return lines.join("\n");
}

function kitDescription(root: string): string {
  const manifest = join(root, "packages/flowpanel/package.json");
  if (!existsSync(manifest)) return "";
  const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const description =
    parsed && typeof parsed === "object"
      ? (parsed as { description?: unknown }).description
      : undefined;
  return typeof description === "string" ? description : "";
}

function header(root: string): string {
  const description = kitDescription(root);
  return [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    ...(description ? [`> ${description}.`] : []),
    "",
    "```bash",
    ...INSTALL,
    "```",
    "",
    `Docs: ${siteConfig.url}/docs · Source: ${siteConfig.repo.url}`,
    "",
    "Generated from the reference documentation. Property tables come from the",
    "packages' own TypeScript declarations. Code blocks are excerpts from that",
    "documentation: blocks the docs mark `twoslash` are type-checked in CI,",
    "`excerpt` blocks are illustrative and may omit surrounding code.",
    "",
  ].join("\n");
}

export function generateLlmsText(root: string): string {
  const context: ExpansionContext = {
    siteRoot: join(root, "apps/site"),
    project: createTypeProject(root),
    cli: buildCliReference(createProgram()),
  };
  const reference = readPages(root, "reference", context).map(renderPage).join("\n");
  return `${[header(root), reference].filter(Boolean).join("\n").trimEnd()}\n`;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trimEnd();
}

export function checkLlms(root: string): DocsProblem[] {
  const file = join(root, LLMS_FILE);
  const generated = generateLlmsText(root);
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (normalize(current) === normalize(generated)) return [];
  return [
    {
      code: "llms-stale",
      file: LLMS_FILE,
      line: 1,
      message: existsSync(file)
        ? "llms.txt no longer matches the reference documentation."
        : "llms.txt is missing from @flowpanel/kit.",
      suggestion: "Run pnpm docs:llms.",
    },
  ];
}
