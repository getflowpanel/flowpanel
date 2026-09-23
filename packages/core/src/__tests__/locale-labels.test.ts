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
