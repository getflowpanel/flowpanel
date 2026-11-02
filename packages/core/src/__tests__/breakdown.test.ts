import { describe, expect, it } from "vitest";
import { enumOf } from "../builders/enum-of";
import { breakdown } from "../runtime/breakdown";
import { OTHER_KEY } from "../runtime/series";

const orders = [
  { platform: "kwork", orders: 30 },
  { platform: "kwork", orders: 10 },
  { platform: "fl", orders: 25 },
  { platform: "weblancer", orders: 15 },
  { platform: "habr", orders: 12 },
  { platform: "youdo", orders: 8 },
];

describe("breakdown", () => {
  it("ranks rows, keeps the top N and folds the rest with shares of the real total", () => {
    const rows = breakdown(orders, { by: "platform", value: "orders", top: 2 });
    expect(rows).toEqual([
      { key: "kwork", label: "kwork", value: 40, share: 0.4 },
      { key: "fl", label: "fl", value: 25, share: 0.25 },
      { key: OTHER_KEY, label: OTHER_KEY, value: 35, share: 0.35 },
    ]);
    expect(rows.reduce((sum, row) => sum + (row.share ?? 0), 0)).toBe(1);
  });

  it("keeps declared keys at zero, names keys and folds the previous rows the same way", () => {
    const runs = [
      { platform: "kwork" },
      { platform: "kwork" },
      { platform: "fl" },
      { platform: "weblancer" },
    ];
    expect(
      breakdown(runs, {
        by: "platform",
        keys: ["kwork", "freelancehunt"],
        labels: { kwork: "Kwork" },
        previous: [{ platform: "kwork" }],
      }),
    ).toEqual([
      { key: "kwork", label: "Kwork", value: 2, share: 0.5, previous: 1 },
      { key: "fl", label: "fl", value: 1, share: 0.25, previous: 0 },
      { key: "weblancer", label: "weblancer", value: 1, share: 0.25, previous: 0 },
      { key: "freelancehunt", label: "freelancehunt", value: 0, share: 0, previous: 0 },
    ]);
  });

  it("never folds a declared key into the rest, even when top would otherwise cut it", () => {
    const rows = breakdown(orders, { by: "platform", value: "orders", keys: ["youdo"], top: 2 });
    expect(rows).toEqual([
      { key: "kwork", label: "kwork", value: 40, share: 0.4 },
      { key: "fl", label: "fl", value: 25, share: 0.25 },
      { key: "youdo", label: "youdo", value: 8, share: 0.08 },
      { key: OTHER_KEY, label: OTHER_KEY, value: 27, share: 0.27 },
    ]);
    expect(rows.reduce((sum, row) => sum + (row.share ?? 0), 0)).toBe(1);
  });

  it("names keys from an enumOf and links every row but the folded rest", () => {
    const Platform = enumOf({ kwork: "Kwork", fl: "FL.ru", habr: "Habr" });
    const rows = breakdown(orders, {
      by: "platform",
      labels: Platform,
      top: 2,
      href: (key) => ({ resource: "order", filter: { platform: key } }),
    });
    expect(rows.map((row) => row.label)).toEqual(["Kwork", "FL.ru", OTHER_KEY]);
    expect(rows[0]?.href).toEqual({ resource: "order", filter: { platform: "kwork" } });
    expect(rows[2]?.href).toBeUndefined();
  });

  it("folds with a function and drops a key whose fold is null", () => {
    const runs = [
      { p: "a", ok: 1 },
      { p: "a", ok: 0 },
      { p: "b", ok: 1 },
    ];
    const rate = (group: typeof runs) =>
      group.length === 0 ? null : group.filter((run) => run.ok === 1).length / group.length;
    expect(
      breakdown(runs, { by: "p", value: rate, keys: ["c"] }).map((row) => [row.key, row.value]),
    ).toEqual([
      ["b", 1],
      ["a", 0.5],
    ]);
  });
});
