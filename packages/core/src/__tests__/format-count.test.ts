import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, formatCount, mergeLabels } from "../types/labels";

const records = { one: "{n} запись", few: "{n} записи", many: "{n} записей", other: "{n} записи" };

describe("formatCount", () => {
  it("picks the Russian plural form for the count", () => {
    expect(formatCount(records, 1, "ru-RU")).toBe("1 запись");
    expect(formatCount(records, 3, "ru-RU")).toBe("3 записи");
    expect(formatCount(records, 5, "ru-RU")).toBe("5 записей");
    expect(formatCount(records, 21, "ru-RU")).toBe("21 запись");
    expect(formatCount(records, 1333, "ru-RU", "1 333")).toBe("1 333 записи");
  });

  it("falls back to other for a category the label leaves out", () => {
    expect(formatCount({ other: "{n} rows" }, 1, "en-US")).toBe("1 rows");
  });

  it("keeps a plain string template working", () => {
    expect(formatCount("{n} selected", 2, "en-US")).toBe("2 selected");
  });

  it("merges plural count labels without touching the string templates", () => {
    const labels = mergeLabels({ plurals: { results: records } });
    expect(labels.plurals?.results).toEqual(records);
    expect(labels.table.results).toBe(DEFAULT_LABELS.table.results);
    expect(DEFAULT_LABELS.plurals).toBeUndefined();
    expect(mergeLabels({ table: { results: "{n} rows" } }).plurals).toBeUndefined();
  });
});
