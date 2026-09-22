import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkLlms, generateLlmsText, LLMS_FILE } from "../docs/generate-llms";

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
].join("\n");

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
