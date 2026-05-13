import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, mergeLabels } from "../labels.js";

describe("mergeLabels", () => {
  it("returns the singleton DEFAULT_LABELS when user is undefined", () => {
    expect(mergeLabels()).toBe(DEFAULT_LABELS);
  });
  it("returns the singleton when user is empty object", () => {
    // Empty user object should NOT clone — return defaults to keep referential equality.
    expect(mergeLabels({})).toBe(DEFAULT_LABELS);
  });
  it("merges nested groups, keeping defaults for unset keys", () => {
    const m = mergeLabels({ actions: { save: "Сохранить" } });
    expect(m.actions.save).toBe("Сохранить");
    expect(m.actions.cancel).toBe("Cancel"); // default preserved
    expect(m.noResults).toBe("No results"); // top-level default preserved
  });
  it("user functions replace defaults (not call them)", () => {
    const m = mergeLabels({ bulkBar: { selected: (n) => `${n} выбрано` } });
    expect(m.bulkBar.selected(3)).toBe("3 выбрано");
    expect(m.bulkBar.clear).toBe("Clear"); // default preserved
  });
  it("does not mutate DEFAULT_LABELS", () => {
    const before = JSON.stringify({
      ...DEFAULT_LABELS,
      bulkBar: { ...DEFAULT_LABELS.bulkBar, selected: "fn" },
    });
    mergeLabels({ actions: { save: "X" } });
    const after = JSON.stringify({
      ...DEFAULT_LABELS,
      bulkBar: { ...DEFAULT_LABELS.bulkBar, selected: "fn" },
    });
    expect(after).toBe(before);
  });
});
