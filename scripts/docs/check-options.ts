import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  type InterfaceDeclaration,
  type Node,
  Project,
  SyntaxKind,
  type TypeAliasDeclaration,
} from "ts-morph";
import { walkFiles } from "./files";
import { OPTION_ALLOWLIST, type OptionAllowlistEntry } from "./option-allowlist";
import type { DocsProblem } from "./types";

export const OPTION_TYPE_SUFFIXES = [
  "Config",
  "Context",
  "Def",
  "Item",
  "Options",
  "Row",
  "Spec",
  "Tab",
] as const;

const CONSUMER_PACKAGES = [
  "next",
  "react",
  "charts",
  "cli",
  "adapter-drizzle",
  "adapter-prisma",
  "adapter-bullmq",
  "flowpanel",
];

const ALLOWLIST_FILE = "scripts/docs/option-allowlist.ts";

const EXCLUDED_DIRECTORIES = ["packages/core/src/types", "packages/core/src/locales"];

const READ_PATTERNS = [
  /\.([A-Za-z_$][\w$]*)/g,
  /\[\s*["']([A-Za-z_$][\w$]*)["']\s*\]/g,
  /\{\s*([A-Za-z_$][\w$]*)/g,
  /\b([A-Za-z_$][\w$]*)\s*\}/g,
];

const COMPUTED_READ = /\b([A-Za-z_$][\w$]*)\s*\[\s*[A-Za-z_$]/g;

export interface CheckOptionsInput {
  allowlist?: OptionAllowlistEntry[];
}

interface DeclaredMember {
  type: string;
  member: string;
  file: string;
  line: number;
}

function displayPath(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

function isTestFile(file: string): boolean {
  return file.includes(`${sep}__tests__${sep}`) || /\.test\.tsx?$/.test(file);
}

function sourceFilesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return [...walkFiles(directory, ".ts"), ...walkFiles(directory, ".tsx")];
}

export function consumerFiles(root: string): string[] {
  const excluded = EXCLUDED_DIRECTORIES.map((directory) => `${join(root, directory)}${sep}`);
  const files = CONSUMER_PACKAGES.flatMap((name) =>
    sourceFilesUnder(join(root, "packages", name, "src")),
  ).concat(sourceFilesUnder(join(root, "packages/core/src")));
  return files
    .filter((file) => !isTestFile(file) && !excluded.some((prefix) => file.startsWith(prefix)))
    .sort((a, b) => a.localeCompare(b));
}

export function stripComments(source: string): string {
  let output = "";
  let index = 0;
  let quote = "";
  while (index < source.length) {
    const character = source[index] as string;
    const next = source[index + 1];
    if (quote) {
      if (character === "\\") {
        output += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === quote) quote = "";
      output += character;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      output += character;
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

export interface ReadEvidence {
  members: Set<string>;
  computedGroups: Set<string>;
}

export function readEvidence(sources: Iterable<string>): ReadEvidence {
  const members = new Set<string>();
  const computedGroups = new Set<string>();
  for (const source of sources) {
    const code = stripComments(source);
    for (const pattern of READ_PATTERNS) {
      for (const match of code.matchAll(pattern)) members.add(match[1] as string);
    }
    for (const match of code.matchAll(COMPUTED_READ)) computedGroups.add(match[1] as string);
  }
  return { members, computedGroups };
}

function optionTypes(root: string): (InterfaceDeclaration | TypeAliasDeclaration)[] {
  const project = new Project({
    ...(existsSync(join(root, "tsconfig.base.json"))
      ? { tsConfigFilePath: join(root, "tsconfig.base.json") }
      : {}),
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths(join(root, "packages/core/src/types/**/*.ts"));
  return project
    .getSourceFiles()
    .filter((file) => !isTestFile(file.getFilePath()))
    .flatMap((file) => [...file.getInterfaces(), ...file.getTypeAliases()])
    .filter(
      (declaration) =>
        declaration.isExported() &&
        OPTION_TYPE_SUFFIXES.some((suffix) => declaration.getName().endsWith(suffix)),
    );
}

function memberPath(node: Node, declaration: Node): string {
  const parts: string[] = [];
  let current: Node | undefined = node;
  while (current && current !== declaration) {
    if (current.isKind(SyntaxKind.PropertySignature) || current.isKind(SyntaxKind.MethodSignature))
      parts.unshift(current.getName());
    current = current.getParent();
  }
  return parts.join(".");
}

function declaredMembers(root: string): DeclaredMember[] {
  const members: DeclaredMember[] = [];
  const seen = new Set<string>();
  for (const declaration of optionTypes(root)) {
    const nodes = [
      ...declaration.getDescendantsOfKind(SyntaxKind.PropertySignature),
      ...declaration.getDescendantsOfKind(SyntaxKind.MethodSignature),
    ].sort((a, b) => a.getPos() - b.getPos());
    for (const node of nodes) {
      const member = memberPath(node, declaration);
      const key = `${declaration.getName()}.${member}`;
      if (seen.has(key)) continue;
      seen.add(key);
      members.push({
        type: declaration.getName(),
        member,
        file: displayPath(root, declaration.getSourceFile().getFilePath()),
        line: node.getStartLineNumber(),
      });
    }
  }
  return members;
}

function allowlistLine(root: string, entry: OptionAllowlistEntry): number {
  const file = join(root, ALLOWLIST_FILE);
  if (!existsSync(file)) return 1;
  const lines = readFileSync(file, "utf8").split("\n");
  const index = lines.findIndex(
    (line) => line.includes(`"${entry.type}"`) && line.includes(`"${entry.member}"`),
  );
  return index < 0 ? 1 : index + 1;
}

export function checkOptions(root: string, input: CheckOptionsInput = {}): DocsProblem[] {
  const allowlist = input.allowlist ?? OPTION_ALLOWLIST;
  const evidence = readEvidence(consumerFiles(root).map((file) => readFileSync(file, "utf8")));
  const problems: DocsProblem[] = [];
  const matched = new Set<string>();

  for (const declared of declaredMembers(root)) {
    const path = declared.member.split(".");
    const leaf = path.at(-1) as string;
    const group = path.at(-2);
    if (evidence.members.has(leaf)) continue;
    if (group && evidence.computedGroups.has(group)) continue;
    const key = `${declared.type}.${declared.member}`;
    const entry = allowlist.find(
      (item) => item.type === declared.type && item.member === declared.member,
    );
    if (entry) {
      matched.add(key);
      continue;
    }
    problems.push({
      code: "option-unread",
      file: declared.file,
      line: declared.line,
      message: `${key} is declared but no runtime source reads it.`,
      suggestion:
        "Wire the option into a runtime consumer, delete it, or allowlist it with a reason in scripts/docs/option-allowlist.ts.",
    });
  }

  for (const entry of allowlist) {
    const key = `${entry.type}.${entry.member}`;
    if (matched.has(key)) continue;
    problems.push({
      code: "option-allowlist-stale",
      file: ALLOWLIST_FILE,
      line: allowlistLine(root, entry),
      message: `${key} is allowlisted as unread but is now read or no longer declared.`,
      suggestion: "Delete the allowlist entry.",
    });
  }

  return problems;
}
