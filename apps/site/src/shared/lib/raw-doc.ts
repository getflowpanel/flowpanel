import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractApiSymbol } from "./api-signature";
import { type CliCommandDoc, readCliReference } from "./cli-reference";
import { readCompatibility } from "./compatibility";
import { readThemeSlots } from "./theme-slots";
import { getTypeGenerator } from "./type-project";

interface RawDocOptions {
  contentRoot?: string;
  siteRoot?: string;
  repositoryRoot?: string;
}

async function replaceAsync(
  source: string,
  pattern: RegExp,
  replace: (match: RegExpExecArray) => Promise<string>,
): Promise<string> {
  const matches = [...source.matchAll(pattern)];
  const values = await Promise.all(matches.map(replace));
  let cursor = 0;
  let output = "";
  for (const [index, match] of matches.entries()) {
    output += source.slice(cursor, match.index);
    output += values[index] ?? "";
    cursor = match.index + match[0].length;
  }
  return output + source.slice(cursor);
}

function markdownCli(command: CliCommandDoc): string {
  const lines = [`**Usage:** \`${command.usage}\``, "", command.description];
  if (command.arguments.length > 0) {
    lines.push("", "| Argument | Status |", "| --- | --- |");
    for (const argument of command.arguments) {
      lines.push(`| \`${argument.syntax}\` | ${argument.required ? "required" : "optional"} |`);
    }
  }
  if (command.options.length > 0) {
    lines.push("", "| Option | Description | Default |", "| --- | --- | --- |");
    for (const option of command.options) {
      lines.push(
        `| \`${option.flags}\` | ${option.description} | ${option.defaultValue ? `\`${option.defaultValue}\`` : "—"} |`,
      );
    }
  }
  return lines.join("\n");
}

async function expandBuildComponents(
  body: string,
  siteRoot: string,
  repositoryRoot: string,
): Promise<string> {
  let output = body;
  output = output.replace(
    /<CliReference(?:\s+command="([^"]+)")?\s*\/>/g,
    (_all, name: string | undefined) => {
      const docs = readCliReference();
      if (name) {
        const command = docs.find((entry) => entry.name === name);
        return command ? markdownCli(command) : `Unknown CLI command: ${name}`;
      }
      return docs.slice(1).map(markdownCli).join("\n\n");
    },
  );
  output = output.replace(/<Compatibility\s*\/>/g, () => {
    const rows = readCompatibility(repositoryRoot).map(
      (item) => `| ${item.requirement} | \`${item.range}\` | ${item.note} |`,
    );
    return ["| Requirement | Supported range | Note |", "| --- | --- | --- |", ...rows].join("\n");
  });
  output = output.replace(/<ThemeSlots\s*\/>/g, () => {
    const rows = readThemeSlots(siteRoot).map(
      (slot) => `| \`${slot.name}\` | \`${slot.type.replaceAll("|", "\\|")}\` |`,
    );
    return ["| Slot | Component contract |", "| --- | --- |", ...rows].join("\n");
  });
  output = await replaceAsync(
    output,
    /<ApiSignature\b[^>]*\bpath="([^"]+)"[^>]*\bname="([^"]+)"[^>]*\/?\s*>/g,
    async (match) => {
      const symbol = extractApiSymbol({
        path: path.resolve(siteRoot, match[1] ?? ""),
        name: match[2] ?? "",
      });
      return [
        symbol.description,
        symbol.deprecated ? `> Deprecated: ${symbol.deprecated}` : "",
        ...symbol.signatures.map((signature) => `\`\`\`ts\n${signature}\n\`\`\``),
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  );
  output = await replaceAsync(
    output,
    /<AutoTypeTable\b[^>]*\bpath="([^"]+)"[^>]*\bname="([^"]+)"[^>]*\/?\s*>/g,
    async (match) => {
      const sourcePath = match[1] ?? "";
      const symbolName = match[2] ?? "";
      const docs = await getTypeGenerator().generateTypeTable(
        { path: sourcePath, name: symbolName },
        { basePath: siteRoot },
      );
      const sections: string[] = [];
      for (const doc of docs) {
        sections.push(`**${doc.name}**${doc.description ? ` — ${doc.description}` : ""}`);
        sections.push("| Property | Type | Required | Description |", "| --- | --- | --- | --- |");
        for (const entry of doc.entries) {
          sections.push(
            `| \`${entry.name}\` | \`${entry.simplifiedType.replaceAll("|", "\\|")}\` | ${entry.required ? "yes" : "no"} | ${entry.description.replaceAll("|", "\\|")} |`,
          );
        }
      }
      return sections.join("\n");
    },
  );
  return output
    .replace(/<AdapterTabs>|<\/AdapterTabs>/g, "")
    .replace(
      /<AdapterTab\s+adapter="([^"]+)">/g,
      (_all, adapter: string) => `#### ${adapter[0]?.toUpperCase()}${adapter.slice(1)}\n`,
    )
    .replace(/<\/AdapterTab>/g, "");
}

export async function readRawDocBody(
  slug: string[],
  options: RawDocOptions = {},
): Promise<string | null> {
  const siteRoot = options.siteRoot ?? process.cwd();
  const contentRoot = options.contentRoot ?? path.join(siteRoot, "content/docs");
  const repositoryRoot = options.repositoryRoot ?? path.resolve(siteRoot, "../..");
  const resolvedContentRoot = path.resolve(contentRoot);
  const candidates = [
    path.resolve(contentRoot, `${slug.join("/")}.mdx`),
    path.resolve(contentRoot, ...slug, "index.mdx"),
  ];
  if (candidates.some((file) => !file.startsWith(`${resolvedContentRoot}${path.sep}`))) {
    return null;
  }
  try {
    let file: string | undefined;
    let raw: string | undefined;
    for (const candidate of candidates) {
      try {
        raw = await readFile(candidate, "utf8");
        file = candidate;
        break;
      } catch {
        // Try the directory index form used by canonical `/section` pages.
      }
    }
    if (file === undefined || raw === undefined) return null;
    let body = stripFrontmatter(raw);
    body = await replaceAsync(
      body,
      /<include(?:\s[^>]*)?>([^<]+\.(tsx?))<\/include>/g,
      async (match) => {
        const target = path.resolve(path.dirname(file), (match[1] ?? "").trim());
        const code = await readFile(target, "utf8");
        return `\`\`\`${match[2]}\n${code.trimEnd()}\n\`\`\``;
      },
    );
    return expandBuildComponents(body, siteRoot, repositoryRoot);
  } catch {
    return null;
  }
}

function stripFrontmatter(source: string): string {
  if (!source.startsWith("---")) return source;
  const end = source.indexOf("\n---", 3);
  if (end === -1) return source;
  return source.slice(end + 4).replace(/^\s+/, "");
}
