import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, formatLabel, type LabelsConfig, mergeLabels } from "../labels";

describe("mergeLabels", () => {
  it("returns the singleton DEFAULT_LABELS when user is undefined", () => {
    expect(mergeLabels()).toBe(DEFAULT_LABELS);
  });
  it("returns the singleton when user is empty object", () => {
    expect(mergeLabels({})).toBe(DEFAULT_LABELS);
  });
  it("merges nested groups, keeping defaults for unset keys", () => {
    const m = mergeLabels({ actions: { save: "Сохранить" } });
    expect(m.actions.save).toBe("Сохранить");
    expect(m.actions.cancel).toBe("Cancel"); // default preserved
    expect(m.noResults).toBe("No results");
  });
  it("user template strings replace defaults", () => {
    const m = mergeLabels({ bulkBar: { selected: "{n} выбрано" } });
    expect(m.bulkBar.selected).toBe("{n} выбрано");
    expect(m.bulkBar.clear).toBe("Clear"); // default preserved
  });
  it("does not mutate DEFAULT_LABELS", () => {
    const before = JSON.stringify(DEFAULT_LABELS);
    mergeLabels({ actions: { save: "X" }, bulkBar: { selected: "{n} sel" } });
    const after = JSON.stringify(DEFAULT_LABELS);
    expect(after).toBe(before);
  });
  it("keeps defaults for explicit undefined and preserves deliberate empty strings", () => {
    const pagination = { next: "Далее" };
    const config: LabelsConfig = {
      searchPlaceholder: "",
      pagination,
    };
    // A JavaScript caller is not constrained by exactOptionalPropertyTypes.
    Object.assign(config, { noResults: undefined });
    Object.assign(pagination, { previous: undefined });
    const labels = mergeLabels(config);
    expect(labels.noResults).toBe(DEFAULT_LABELS.noResults);
    expect(labels.pagination.previous).toBe(DEFAULT_LABELS.pagination.previous);
    expect(labels.pagination.next).toBe("Далее");
    expect(labels.searchPlaceholder).toBe("");
  });
});

describe("formatLabel", () => {
  it("substitutes {n} placeholder", () => {
    expect(formatLabel("{n} selected", { n: 3 })).toBe("3 selected");
  });
  it("substitutes multiple placeholders", () => {
    expect(formatLabel("Search {label}… ({n})", { label: "users", n: 12 })).toBe(
      "Search users… (12)",
    );
  });
  it("leaves unknown placeholders intact", () => {
    expect(formatLabel("{n} of {total}", { n: 1 })).toBe("1 of {total}");
  });
  it("template without placeholders returns unchanged", () => {
    expect(formatLabel("hello", { n: 1 })).toBe("hello");
  });
});
