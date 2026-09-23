import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS, formatCount, mergeLabels, RU_LABELS } from "../labels";

const count = (n: number) =>
  formatCount(RU_LABELS.plurals?.results ?? RU_LABELS.table.results, n, "ru-RU");
const selected = (n: number) =>
  formatCount(RU_LABELS.plurals?.selected ?? RU_LABELS.bulkBar.selected, n, "ru-RU");

describe("the Russian preset's count plurals", () => {
  it("inflects the row count", () => {
    expect([1, 3, 5, 21, 1333].map(count)).toEqual([
      "1 запись",
      "3 записи",
      "5 записей",
      "21 запись",
      "1333 записи",
    ]);
  });

  it("inflects the selection count", () => {
    expect([1, 2, 11].map(selected)).toEqual([
      "Выбран 1 элемент",
      "Выбрано 2 элемента",
      "Выбрано 11 элементов",
    ]);
  });

  it("gives way to a host's own string template for the same count", () => {
    const labels = mergeLabels({ table: { results: "Всего: {n}" } }, RU_LABELS);
    expect(labels.plurals?.results).toBeUndefined();
    expect(labels.plurals?.selected).toEqual(RU_LABELS.plurals?.selected);
    expect(mergeLabels(DEFAULT_LABELS, RU_LABELS)).toEqual(DEFAULT_LABELS);
  });
});
