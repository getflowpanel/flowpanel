import { describe, expect, it } from "vitest";
import { layoutColumns } from "../column-sizing";
import type { DataTableColumn } from "../data-table-types";

type Row = Record<string, unknown>;
const col = (field: string, extra: Partial<DataTableColumn<Row>> = {}): DataTableColumn<Row> => ({
  field,
  ...extra,
});
const badge = (...labels: string[]) => ({
  format: {
    kind: "badge" as const,
    labels: Object.fromEntries(labels.map((label) => [label.toLowerCase(), label])),
  },
});
const money = { format: { kind: "money" as const, minorUnits: 2 } };

/** Resolves a width the way the browser does, for a scroller `frame` px wide. */
function px(css: string, frame: number): number {
  const expression = css
    .replace(/(\d*\.?\d+)cqw/g, (_, n: string) => `(${n}*${frame / 100})`)
    .replace(/(\d*\.?\d+)rem/g, (_, n: string) => `(${n}*16)`)
    .replace(/(\d*\.?\d+)px/g, "($1)")
    .replace(/calc\(/g, "(");
  const clamp = (low: number, value: number, high: number) => Math.min(Math.max(low, value), high);
  return new Function("clamp", "max", `return ${expression};`)(clamp, Math.max);
}

function at(
  columns: DataTableColumn<Row>[],
  frame: number,
  options: Parameters<typeof layoutColumns>[1] = {},
): Record<string, number> {
  const { widths } = layoutColumns(columns, options);
  return Object.fromEntries([...widths].map(([field, css]) => [field, px(css, frame)]));
}

const sum = (widths: Record<string, number>) => Object.values(widths).reduce((a, b) => a + b, 0);
const SELECTION = { extrasRem: 3 };

/** Widths in rem as the server estimates them for the demo's rows. */
const matches = [
  col("productId", { label: "Catalog product", type: "reference", textRem: 17.75 }),
  col("listingId", { label: "Listing", type: "reference", textRem: 22.5 }),
  col("confidence", { type: "number", align: "right" }),
  col("status", badge("Pending", "Approved", "Rejected")),
  col("model", { type: "string", textRem: 8 }),
  col("matchedAt", { label: "Matched", type: "date" }),
];

const listings = [
  col("title", { label: "Product", content: "long", textRem: 22.5 }),
  col("site", { label: "Marketplace", ...badge("Amazon", "eBay", "Walmart", "AliExpress") }),
  col("priceCents", { label: "Price", ...money }),
  col("stock", badge("In stock", "Low stock", "Out of stock")),
  col("rating", { type: "number" }),
  col("reviews", { format: "number" }),
  col("scrapedAt", { label: "Found", type: "date" }),
];

const products = [
  col("sku", { label: "SKU", type: "string", textRem: 9.25 }),
  col("title", { label: "Product", content: "long", textRem: 17.75 }),
  col("brand", { type: "string", textRem: 5.75 }),
  col("category", { type: "string", textRem: 7.75 }),
  col("ourPriceCents", { label: "Our price", ...money }),
];

const customers = [
  col("company", { type: "string", textRem: 10.5 }),
  col("name", { label: "Contact", type: "string", textRem: 7 }),
  col("email", { content: "email", textRem: 13.5 }),
  col("plan", badge("Free", "Starter", "Pro", "Business")),
  col("status", badge("Active", "Past due", "Canceled")),
  col("createdAt", { label: "Joined", type: "date" }),
];

describe("column widths by what a column holds", () => {
  it("gives a match's references the room, and keeps the short model name whole", () => {
    for (const frame of [1050, 1230]) {
      const widths = at(matches, frame, SELECTION);
      expect(widths.productId).toBeGreaterThan(widths.model ?? 0);
      expect(widths.listingId).toBeGreaterThan(widths.model ?? 0);
      expect(widths.model).toBeCloseTo((8 + 2.5) * 16, 3);
      expect(sum(widths) + 48).toBeCloseTo(frame, 0);
    }
    const wide = at(matches, 1600, SELECTION);
    expect(wide.model).toBeCloseTo((8 + 2.5) * 16, 3);
    expect(wide.listingId).toBeGreaterThanOrEqual(26 * 16);
  });

  it("fits listings in a 1050 px frame by narrowing numbers and dates before it scrolls", () => {
    const { minWidth } = layoutColumns(listings, SELECTION);
    expect(Number.parseFloat(minWidth) * 16).toBeLessThanOrEqual(1050);
    const widths = at(listings, 1050, SELECTION);
    expect(sum(widths) + 48).toBeCloseTo(1050, 0);
    expect(widths.priceCents).toBeGreaterThanOrEqual(7 * 16);
    expect(widths.scrapedAt).toBeGreaterThanOrEqual(10 * 16);
    for (const other of ["site", "priceCents", "stock", "rating", "reviews", "scrapedAt"]) {
      expect(widths.title).toBeGreaterThan(widths[other] ?? 0);
    }
  });

  it("keeps a product name at least as wide as the text beside it in a record tab", () => {
    expect(Number.parseFloat(layoutColumns(products).minWidth) * 16).toBeLessThanOrEqual(694);
    for (const frame of [600, 694, 814, 1050, 1230]) {
      const widths = at(products, frame);
      for (const neighbour of ["sku", "brand", "category"]) {
        expect(widths.title).toBeGreaterThanOrEqual(widths[neighbour] ?? 0);
      }
    }
    expect(at(products, 1050).title).toBeGreaterThanOrEqual((17.75 + 2.5) * 16);
  });

  it("shows every customer email whole in a 1050 px frame, and gives the name the rest", () => {
    const narrow = at(customers, 1050, SELECTION);
    expect(narrow.email).toBeCloseTo((13.5 + 2.5) * 16, 3);
    expect(narrow.company).toBeCloseTo((10.5 + 2.5) * 16, 3);
    const wide = at(customers, 1230, SELECTION);
    expect(wide.email).toBeCloseTo((13.5 + 2.5) * 16, 3);
    expect(wide.company).toBeGreaterThan(narrow.company ?? 0);
  });

  it("holds every column at its narrowest once the frame is narrower than the table", () => {
    const { minWidth } = layoutColumns(matches, SELECTION);
    const mins = at(matches, 400, SELECTION);
    expect(sum(mins) + 48).toBeCloseTo(Number.parseFloat(minWidth) * 16, 3);
    expect(mins.productId).toBe(("Catalog product".length * 45 + 300) * 0.16);
    expect(mins.matchedAt).toBe(10 * 16);
  });

  it("sizes a badge column by its longest label, and 9rem when the labels are unknown", () => {
    const width = (labels: Record<string, string>) =>
      layoutColumns([col("stock", { format: { kind: "badge", labels } })]).widths.get("stock");
    expect(width({ in: "In stock", out: "Out of stock" })).toBe("8.5rem");
    expect(width({ a: "A" })).toBe("6rem");
    expect(width({ x: "A very long status label that runs on" })).toBe("11rem");
    expect(layoutColumns([col("state", { type: "enum" })]).widths.get("state")).toBe("9rem");
  });

  it("keeps a dragged width, a set width and a pinned column as they are", () => {
    const options = { overrides: { title: 300 }, pinned: new Set(["brand"]) };
    const { widths } = layoutColumns(
      [...products, col("notes", { width: 200 }), col("tags", { width: "20%" })],
      options,
    );
    expect(widths.get("title")).toBe("300px");
    expect(widths.get("brand")).toBe("8.25rem");
    expect(widths.get("notes")).toBe("12.5rem");
    expect(widths.get("tags")).toBe("20%");
  });

  it("falls back to sizes by kind when the server sent no values", () => {
    const { widths } = layoutColumns([
      col("name"),
      col("description", { content: "long" }),
      col("website", { content: "link" }),
    ]);
    expect(px(widths.get("description") ?? "", 2000)).toBeGreaterThan(20 * 16);
    expect(px(widths.get("website") ?? "", 2000)).toBe(14 * 16);
    expect(px(widths.get("name") ?? "", 2000)).toBe(12 * 16);
  });

  it("lets long text shrink beside a pinned text column", () => {
    const columns = [
      col("name", { type: "string", textRem: 23.5 }),
      col("description", { content: "long", textRem: 23.5 }),
    ];
    const { minWidth } = layoutColumns(columns, { pinned: new Set(["name"]) });
    expect(Number.parseFloat(minWidth)).toBe(26 + 10);
  });

  it("gives what is left to numbers and dates when no text column can take it", () => {
    const widths = at(
      [col("mrr", money), col("arr", money), col("createdAt", { type: "date" })],
      1200,
      { extrasRem: 3 + 3.5 },
    );
    expect(sum(widths) + 48 + 56).toBeCloseTo(1200, 0);
  });

  it("counts wide script in a badge label double, so the label is not cut", () => {
    const { widths } = layoutColumns([
      col("state", { label: "状態", format: { kind: "badge", labels: { due: "支払い期限切れ" } } }),
    ]);
    expect(widths.get("state")).toBe("9.5rem");
  });

  it("stops a link's ideal at the width its link is drawn to", () => {
    const widths = at(
      [col("id", { type: "number" }), col("website", { format: "url", textRem: 40 })],
      2000,
    );
    expect(widths.website).toBe(20 * 16 + (2000 - 20 * 16 - 8 * 16));
    expect(px(layoutColumns([col("website", { format: "url", textRem: 40 })]).minWidth, 0)).toBe(
      8 * 16,
    );
  });

  it("sums a header's characters exactly, so ten narrow ones are 4.5rem", () => {
    const { widths } = layoutColumns([col("flag", { label: "abcdefghij", type: "boolean" })]);
    expect(widths.get("flag")).toBe("7.5rem");
  });
});
