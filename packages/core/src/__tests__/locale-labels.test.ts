import { describe, expect, it } from "vitest";
import type { Adapter, LabelsConfig } from "../index";
import { DEFAULT_LABELS, defineAdmin, mergeLabels, RU_LABELS, resource } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function labelsFor(locale: string | undefined, labels?: LabelsConfig) {
  const config = defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource("users", { columns: [] })],
    ...(locale ? { formatting: { locale } } : {}),
    ...(labels ? { labels } : {}),
  });
  return mergeLabels(config.labels);
}

describe("chrome labels follow formatting.locale", () => {
  it("uses the Russian preset for a Russian locale with no labels", () => {
    expect(labelsFor("ru-RU")).toEqual(RU_LABELS);
    expect(labelsFor("ru")).toEqual(RU_LABELS);
  });

  it("merges a partial host override over the Russian preset", () => {
    const labels = labelsFor("ru-RU", { actions: { new: "Добавить" } });
    expect(labels.actions.new).toBe("Добавить");
    expect(labels.actions.cancel).toBe(RU_LABELS.actions.cancel);
    expect(labels.noResults).toBe(RU_LABELS.noResults);
  });

  it("keeps English under a Russian locale when the host passes DEFAULT_LABELS", () => {
    expect(labelsFor("ru-RU", DEFAULT_LABELS)).toEqual(DEFAULT_LABELS);
  });

  it("keeps English for every other locale", () => {
    expect(labelsFor("en-US")).toEqual(DEFAULT_LABELS);
    expect(labelsFor("de-DE")).toEqual(DEFAULT_LABELS);
    expect(labelsFor("rup")).toEqual(DEFAULT_LABELS);
    expect(labelsFor(undefined)).toEqual(DEFAULT_LABELS);
  });
});

type Tree = string | { [key: string]: Tree };

function paths(tree: Tree, prefix = ""): Map<string, string> {
  if (typeof tree === "string") return new Map([[prefix, tree]]);
  return new Map(
    Object.entries(tree).flatMap(([key, value]) => [
      ...paths(value, prefix ? `${prefix}.${key}` : key),
    ]),
  );
}

/** Strings that read the same in both languages: codes, symbols, examples and a locale tag. */
const SAME_IN_RUSSIAN = new Set([
  "dateRange.locale",
  "detail.tabCount",
  "pagination.pageSize",
  "timeline.folded",
  "checklist.gap",
  "audit.record",
  "audit.actionOption",
  "widget.points",
  "heatmap.cell",
]);

describe("RU_LABELS", () => {
  const { plurals: _en, ...english } = DEFAULT_LABELS;
  const { plurals: _ru, ...russian } = RU_LABELS;
  const en = paths(english as unknown as Tree);
  const ru = paths(russian as unknown as Tree);

  it("translates every key the English chrome has, and no more", () => {
    const pluralForm = /\.(zero|two|few|many)$/;
    expect([...en.keys()].filter((path) => !ru.has(path))).toEqual([]);
    expect([...ru.keys()].filter((path) => !en.has(path) && !pluralForm.test(path))).toEqual([]);
  });

  it("leaves no English string untranslated", () => {
    const same = [...en].filter(([path, text]) => ru.get(path) === text).map(([path]) => path);
    expect(same.filter((path) => !SAME_IN_RUSSIAN.has(path))).toEqual([]);
  });

  it("keeps every placeholder the English string fills", () => {
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const lost = [...en]
      .filter(([path, text]) =>
        names(text).some((name) => !names(ru.get(path) ?? "").includes(name)),
      )
      .map(([path]) => path);
    expect(lost).toEqual([]);
  });
});
