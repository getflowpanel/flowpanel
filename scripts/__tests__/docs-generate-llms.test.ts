import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { siteConfig } from "../../apps/site/src/shared/lib/site-config";
import { checkLlms, generateLlmsText, LLMS_FILE, unexpanded } from "../docs/generate-llms";
import {
  checkLlmsTopics,
  generateLlmsTopics,
  LLMS_TOPIC_MAX_LINES,
  LLMS_TOPICS_DIR,
} from "../docs/generate-llms-topics";

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

const PAGE = [
  "---",
  "title: Widgets",
  "description: Every widget builder and the options it accepts.",
  "kind: reference",
  "---",
  "",
  'import { Callout } from "fumadocs-ui/components/callout";',
  "",
  "Widgets are the contents of a dashboard section.",
  "",
  "## WidgetContext",
  "",
  '<AutoTypeTable path="../../packages/example/types.ts" name="WidgetContext" />',
  "",
  "<Callout>A widget query runs on the server.</Callout>",
  "",
  "```ts excerpt",
  'import { metric } from "@flowpanel/kit";',
  "",
  'metric("MRR", async ({ db }) => mrr(db));',
  "```",
  "",
  "## Commands",
  "",
  '<CliReference command="init" />',
  "",
  "## Setup",
  "",
  "<Compatibility />",
  "",
  "<AdapterTabs>",
  '  <AdapterTab adapter="drizzle">',
  "    <include>../../snippets/setup.ts</include>",
  "  </AdapterTab>",
  "</AdapterTabs>",
  "",
].join("\n");

const MANIFESTS: Record<string, object> = {
  "packages/cli/package.json": { engines: { node: ">=20" } },
  "packages/next/package.json": { peerDependencies: { next: "^16.0.0" } },
  "packages/react/package.json": { peerDependencies: { react: "^19.0.0" } },
  "packages/adapter-drizzle/package.json": { peerDependencies: { "drizzle-orm": ">=0.45.0" } },
  "packages/adapter-prisma/package.json": { peerDependencies: { "@prisma/client": ">=5.0.0" } },
};

const TYPES = [
  "export interface WidgetContext {",
  "  /** The request's own database handle. */",
  "  db: unknown;",
  "  /**",
  "   * Rows per page.",
  "   *",
  "   * @defaultValue 10",
  "   */",
  "  limit?: number;",
  "}",
  "",
].join("\n");

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-llms-"));
  fixtures.push(root);
  mkdirSync(join(root, "apps/site/content/docs/reference"), { recursive: true });
  mkdirSync(join(root, "packages/example"), { recursive: true });
  mkdirSync(join(root, "packages/flowpanel"), { recursive: true });
  writeFileSync(join(root, "apps/site/content/docs/reference/widgets.mdx"), PAGE);
  writeFileSync(join(root, "packages/example/types.ts"), TYPES);
  mkdirSync(join(root, "apps/site/content/snippets"), { recursive: true });
  writeFileSync(
    join(root, "apps/site/content/snippets/setup.ts"),
    'export const setup = "from the snippet";\n',
  );
  for (const [file, manifest] of Object.entries(MANIFESTS)) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(manifest));
  }
  writeFileSync(
    join(root, "packages/flowpanel/package.json"),
    JSON.stringify({ name: "@fixture/kit", description: "A fixture kit" }),
  );
  return root;
}

describe("llms.txt generation", () => {
  it("opens with the package's own summary and install command", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text.split("\n")[0]?.startsWith("# ")).toBe(true);
    expect(text).toContain("> A fixture kit.");
    expect(text).toContain("pnpm dlx @flowpanel/cli init");
  });

  it("quotes the site description instead of a missing field", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text).toContain(`> ${siteConfig.seo.description}`);
    expect(text).not.toContain("undefined");
  });

  it("inlines included snippets and the compatibility table", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text).toContain('```ts\nexport const setup = "from the snippet";\n```');
    expect(text).toContain("##### Drizzle");
    expect(text).toContain("| Next.js | `^16.0.0` |");
    expect(text).not.toMatch(/<include|<Compatibility|<AdapterTab/);
  });

  it("reports MDX that reaches the output unexpanded", () => {
    expect(unexpanded("llms.txt", "# Docs\n\n<include>a.ts</include>\n")).toEqual([
      expect.objectContaining({ code: "llms-unexpanded", line: 3 }),
    ]);
    expect(unexpanded("llms.txt", "# Docs\n")).toEqual([]);
  });

  it("says which code blocks are type-checked, and keeps the marker that decides it", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text).toContain("blocks the docs mark `twoslash` are type-checked in CI");
    expect(text).toContain("```ts excerpt");
  });

  it("strips MDX imports and components while keeping headings and fenced code", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text).toContain("## Widgets");
    expect(text).toContain("### WidgetContext");
    expect(text).toContain("A widget query runs on the server.");
    expect(text).toContain('metric("MRR", async ({ db }) => mrr(db));');
    expect(text).toContain("Documented types: WidgetContext");
    expect(text).not.toContain("AutoTypeTable");
    expect(text).not.toContain("fumadocs-ui/components/callout");
    expect(text).not.toContain("kind: reference");
    expect(text).toContain('import { metric } from "@flowpanel/kit";');
  });

  it("carries the property table the docs render, defaults included", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text).toContain("| Property | Type | Notes |");
    expect(text).toContain("| `db` | `unknown` | The request's own database handle. |");
    expect(text).toContain("| `limit?` | `number` | Rows per page. Default: `10`. |");
  });

  it("carries the CLI reference the docs render", () => {
    const text = generateLlmsText(fixtureRoot());

    expect(text).toContain("`flowpanel init");
    expect(text).toContain("- `--dry-run`");
    expect(text).not.toContain("CliReference");
  });

  it("reports a stale checked-in file and nothing once it matches", () => {
    const root = fixtureRoot();

    const missing = checkLlms(root);
    expect(missing).toHaveLength(1);
    expect(missing[0]?.code).toBe("llms-stale");
    expect(missing[0]?.file).toBe(LLMS_FILE);

    writeFileSync(join(root, LLMS_FILE), "# flowpanel\n\nstale\n");
    expect(checkLlms(root).map((problem) => problem.code)).toEqual(["llms-stale"]);

    writeFileSync(join(root, LLMS_FILE), generateLlmsText(root));
    expect(checkLlms(root)).toEqual([]);
  });

  it("ignores trailing whitespace differences when comparing", () => {
    const root = fixtureRoot();
    writeFileSync(join(root, LLMS_FILE), `${generateLlmsText(root).trimEnd()}\n\n\n`);

    expect(checkLlms(root)).toEqual([]);
  });
});

function topicRoot(): string {
  const root = fixtureRoot();
  writeFileSync(
    join(root, "apps/site/content/docs/meta.json"),
    JSON.stringify({ pages: ["reference"] }),
  );
  writeFileSync(
    join(root, "apps/site/content/docs/reference/meta.json"),
    JSON.stringify({ title: "Reference", pages: ["widgets"] }),
  );
  return root;
}

describe("llms by topic", () => {
  it("writes a short section as one file, and an index naming each file", () => {
    const files = generateLlmsTopics(topicRoot());
    expect([...files.keys()]).toEqual(["reference.txt", "index.txt"]);
    expect(files.get("reference.txt")).toMatch(/^# .+ — Reference\n/);
    expect(files.get("reference.txt")).toContain("## Widgets");
    expect(files.get("index.txt")).toContain("- llms/reference.txt — Reference: Widgets");
    expect(files.get("index.txt")).toContain("This directory is canonical");
  });

  it("writes a section longer than the limit one page per file", () => {
    const root = topicRoot();
    writeFileSync(
      join(root, "apps/site/content/docs/reference/meta.json"),
      JSON.stringify({ title: "Reference", pages: ["widgets", "tabs"] }),
    );
    writeFileSync(
      join(root, "apps/site/content/docs/reference/tabs.mdx"),
      "---\ntitle: Tabs\n---\n\nOne tab.\n",
    );
    const page = generateLlmsTopics(root).get("reference.txt")?.split("## Tabs")[0] ?? "";
    const files = generateLlmsTopics(root, page.split("\n").length + 2);
    expect([...files.keys()]).toEqual(["reference-widgets.txt", "reference-tabs.txt", "index.txt"]);
    expect(files.get("reference-widgets.txt")).toMatch(/^# .+ — Reference — Widgets\n/);
    expect(files.get("index.txt")).toContain(
      "- llms/reference-widgets.txt — Reference: Widgets. Every widget builder and the options it accepts.",
    );
  });

  it("splits a page longer than the limit at its sections, naming them in the index", () => {
    const files = generateLlmsTopics(topicRoot(), 5);
    const parts = [...files.keys()].filter((file) => file.startsWith("reference-widgets-"));
    expect(parts.length).toBeGreaterThan(1);
    expect(files.get("reference-widgets-1.txt")).toMatch(
      /^# .+ — Reference — Widgets \(part 1\)\n/,
    );
    const text = parts.map((file) => files.get(file)).join("\n");
    for (const heading of text.match(/^### .+$/gm) ?? []) {
      expect(files.get("index.txt")).toContain(heading.slice(4));
    }
  });

  it("keeps every whole-section file within the limit", () => {
    for (const [file, text] of generateLlmsTopics(topicRoot())) {
      if (file.includes("-") || file === "index.txt") continue;
      expect(text.split("\n").length).toBeLessThanOrEqual(LLMS_TOPIC_MAX_LINES);
    }
  });

  it("reports missing, stale and leftover topic files", () => {
    const root = topicRoot();
    expect(checkLlmsTopics(root).map((problem) => problem.file)).toEqual([
      `${LLMS_TOPICS_DIR}/reference.txt`,
      `${LLMS_TOPICS_DIR}/index.txt`,
    ]);
    mkdirSync(join(root, LLMS_TOPICS_DIR), { recursive: true });
    for (const [file, text] of generateLlmsTopics(root)) {
      writeFileSync(join(root, LLMS_TOPICS_DIR, file), text);
    }
    expect(checkLlmsTopics(root)).toEqual([]);
    writeFileSync(join(root, LLMS_TOPICS_DIR, "old.txt"), "gone");
    expect(checkLlmsTopics(root).map((problem) => problem.file)).toEqual([
      `${LLMS_TOPICS_DIR}/old.txt`,
    ]);
  });
});
