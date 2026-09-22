import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkOptions, OPTION_TYPE_SUFFIXES } from "../docs/check-options";

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

const TYPES = [
  "export interface WidgetConfig {",
  "  label: string;",
  "  emptyState?: string;",
  '  kind: "widget";',
  "  chrome?: {",
  "    title?: string;",
  "    footer?: string;",
  "  };",
  "  presets?: { today?: string; yesterday?: string };",
  "}",
  "",
  "export type WidgetItem = { span: number } | { rows: number };",
  "",
  "interface HiddenConfig {",
  "  secret: string;",
  "}",
  "",
  "export type WidgetHelper = (input: HiddenConfig) => string;",
  "",
].join("\n");

const CONSUMER = [
  'import type { WidgetConfig, WidgetItem } from "@flowpanel/core";',
  "",
  "/** Only this comment mentions config.emptyState. */",
  "export function render(config: WidgetConfig, item: WidgetItem, preset: string): string {",
  "  const { rows } = item as { rows: number };",
  "  const wide = (item as { span: number }).span;",
  "  const presets = config.presets ?? {};",
  "  // a dead comment mentioning config.footer",
  "  return [config.label, config.chrome?.title, presets[preset], rows, wide].join('');",
  "}",
  "",
].join("\n");

const LOCALE = 'export const RU = { emptyState: "нет данных", footer: "низ" };\n';

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-options-check-"));
  fixtures.push(root);
  mkdirSync(join(root, "packages/core/src/types"), { recursive: true });
  mkdirSync(join(root, "packages/core/src/locales"), { recursive: true });
  mkdirSync(join(root, "packages/next/src/runtime"), { recursive: true });
  mkdirSync(join(root, "packages/next/src/__tests__"), { recursive: true });
  writeFileSync(join(root, "packages/core/src/types/fixture.ts"), TYPES);
  writeFileSync(join(root, "packages/core/src/locales/ru.ts"), LOCALE);
  writeFileSync(join(root, "packages/next/src/runtime/render.ts"), CONSUMER);
  writeFileSync(
    join(root, "packages/next/src/__tests__/render.test.ts"),
    'it("ignores tests", () => {\n  const value = { kind: "widget" };\n});\n',
  );
  return root;
}

describe("documentation option checks", () => {
  it("reports declared options that no runtime source reads, nested members included", () => {
    const problems = checkOptions(fixtureRoot(), { allowlist: [] });

    expect(problems.map((problem) => problem.message)).toEqual([
      "WidgetConfig.emptyState is declared but no runtime source reads it.",
      "WidgetConfig.kind is declared but no runtime source reads it.",
      "WidgetConfig.chrome.footer is declared but no runtime source reads it.",
    ]);
    expect(problems[0]?.code).toBe("option-unread");
    expect(problems[0]?.file).toBe("packages/core/src/types/fixture.ts");
    expect(problems[0]?.line).toBe(3);
    expect(problems[2]?.line).toBe(7);
  });

  it("counts neither a comment, a locale table nor a test as a runtime consumer", () => {
    const messages = checkOptions(fixtureRoot(), { allowlist: [] }).map(
      (problem) => problem.message,
    );

    expect(messages.join("\n")).toContain("WidgetConfig.emptyState");
    expect(messages.join("\n")).toContain("WidgetConfig.chrome.footer");
    expect(messages.join("\n")).toContain("WidgetConfig.kind");
  });

  it("treats a group read by computed key as reading that group's members", () => {
    const messages = checkOptions(fixtureRoot(), { allowlist: [] }).map(
      (problem) => problem.message,
    );

    expect(messages.join("\n")).not.toContain("presets");
  });

  it("accepts an allowlisted member and reports an allowlist entry that no longer matches", () => {
    const problems = checkOptions(fixtureRoot(), {
      allowlist: [
        { type: "WidgetConfig", member: "emptyState", reason: "fixture: unread on purpose." },
        { type: "WidgetConfig", member: "kind", reason: "fixture: discriminant." },
        { type: "WidgetConfig", member: "chrome.footer", reason: "fixture: nested, unread." },
        { type: "WidgetConfig", member: "label", reason: "fixture: stale, the runtime reads it." },
      ],
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("option-allowlist-stale");
    expect(problems[0]?.file).toBe("scripts/docs/option-allowlist.ts");
    expect(problems[0]?.message).toContain("WidgetConfig.label");
  });

  it("covers every option-shaped suffix and skips types with another suffix", () => {
    expect([...OPTION_TYPE_SUFFIXES]).toEqual([
      "Config",
      "Context",
      "Def",
      "Item",
      "Options",
      "Row",
      "Spec",
      "Tab",
    ]);

    const messages = checkOptions(fixtureRoot(), { allowlist: [] }).map(
      (problem) => problem.message,
    );

    expect(messages.join("\n")).not.toContain("WidgetHelper");
  });
});
