import {
  type ColumnMeta,
  type RequestContext,
  type ResolvedAdminConfig,
  resolveFormatting,
} from "@flowpanel/core";
import { formatDateValue } from "@flowpanel/core/format";
import { describe, expect, it, vi } from "vitest";
import { cellText, columnContent, textRem, widestRem } from "../runtime/column-content";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import { applyReferenceCells } from "../runtime/reference-cells";

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

describe("what a text column holds", () => {
  it("is read from its field name", () => {
    expect(columnContent("email")).toBe("email");
    expect(columnContent("billingEmail")).toBe("email");
    expect(columnContent("websiteUrl")).toBe("link");
    expect(columnContent("description")).toBe("long");
    expect(columnContent("name")).toBeUndefined();
  });

  it("travels with the column to the table, except on a reference", () => {
    const { columns } = prerenderResourceCells<Record<string, unknown>>(
      [
        "email",
        { field: "notes" },
        { field: "customerEmail", reference: { resource: "c", labelField: "email" } },
      ],
      [],
      reqCtx,
    );
    expect(columns.map((column) => column.content)).toEqual(["email", "long", undefined]);
  });
});

describe("how wide a column's values run", () => {
  it("reads the widest shown text, from a render's children when it has one", () => {
    const { columns } = prerenderResourceCells<Record<string, unknown>>(
      [
        "sku",
        { field: "model", render: (row) => <span>{`Model ${String(row.model)}`}</span> },
        { field: "count", render: () => null },
        "missing",
      ],
      [
        { sku: "SNY-WH1000XM5", model: "gpt-4o-mini", count: 12 },
        { sku: "A1", model: "o3", count: 3456 },
      ],
      reqCtx,
    );
    const sku = textRem("SNY-WH1000XM5");
    const model = textRem("Model gpt-4o-mini") + 1;
    expect(columns.map((column) => column.textRem)).toEqual([
      Math.ceil(sku * 4) / 4,
      Math.ceil(model * 4) / 4,
      Math.ceil(textRem("3456") * 4) / 4,
      undefined,
    ]);
  });

  it("measures ids, numbers, money and dates as their cells show them, and leaves badges to their labels", () => {
    const meta = new Map<string, ColumnMeta>(
      (["id", "createdAt"] as const).map((name) => [
        name,
        {
          name,
          type: name === "id" ? "number" : "date",
          nullable: false,
          unique: name === "id",
          primaryKey: name === "id",
        },
      ]),
    );
    const formatting = resolveFormatting({ locale: "en-US", timeZone: "UTC" });
    const { columns } = prerenderResourceCells<Record<string, unknown>>(
      [
        "id",
        { field: "mrr", format: { kind: "money", minorUnits: 2 } },
        "createdAt",
        { field: "plan", format: { kind: "badge", labels: { pro: "Pro" } } },
      ],
      [
        { id: 7, mrr: 129900, createdAt: new Date("2026-10-13T20:55:00Z"), plan: "pro" },
        { id: 1234, mrr: 0, createdAt: null, plan: "pro" },
      ],
      reqCtx,
      { metaByField: meta, formatting },
    );
    const quarter = (rem: number) => Math.ceil(rem * 4) / 4;
    expect(columns.map((column) => column.textRem)).toEqual([
      quarter(textRem("1234")),
      quarter(textRem("$1,299.00")),
      quarter(textRem(formatDateValue(new Date("2026-10-13T20:55:00Z"), formatting))),
      undefined,
    ]);
  });

  it("counts capitals and wide letters wider than narrow ones", () => {
    expect(textRem("ЖШЩ")).toBe(textRem("WWW"));
    expect(textRem("Д")).toBe(textRem("D"));
    expect(textRem("支払い")).toBeGreaterThan(textRem("WWW"));
    expect(textRem("👨‍👩‍👧")).toBeCloseTo((1.3 * 14) / 16, 6);
    expect(textRem("WWWW")).toBeGreaterThan(textRem("MMM"));
    expect(textRem("ABCD")).toBeGreaterThan(textRem("abcd"));
    expect(textRem("abcd")).toBeGreaterThan(textRem("ilj."));
    expect(textRem("  kindle  ")).toBe(textRem("kindle"));
  });

  it("sizes a url column by the text its cell shows, not the address", () => {
    const { columns } = prerenderResourceCells<Record<string, unknown>>(
      [
        { field: "site", format: { kind: "url", label: "Open" } },
        { field: "home", format: "url" },
      ],
      [
        {
          site: "https://example.com/a/very/long/path?with=query",
          home: "https://example.com/docs?q=1",
        },
      ],
      reqCtx,
    );
    expect(columns.map((column) => column.textRem)).toEqual([
      Math.ceil(textRem("Open") * 4) / 4,
      Math.ceil(textRem("example.com/docs") * 4) / 4,
    ]);
  });

  it("warns once in development about a width the table cannot size the other columns around", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let render = 0; render < 2; render++) {
      prerenderResourceCells<Record<string, unknown>>(
        [
          { field: "a", width: "20%" },
          { field: "b", width: "12rem" },
          { field: "c", width: 120 },
        ],
        [],
        reqCtx,
      );
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"a" has width "20%"');
    warn.mockRestore();
  });

  it("caps a long value, so one note cannot take the whole table", () => {
    expect(widestRem([textRem("x".repeat(500))])).toBe(24);
    expect(widestRem([0, 0])).toBeUndefined();
    expect(cellText(["Pro ", <b key="b">plan</b>])).toBe("Pro plan");
  });
});

describe("how long a reference column's labels run", () => {
  it("is read from the labels the rows point to", () => {
    const config: Pick<ResolvedAdminConfig, "paths"> = { paths: { admin: "/admin", api: "/api" } };
    const defs = [{ field: "productId", reference: { resource: "products", labelField: "title" } }];
    const rows: Record<string, unknown>[] = [
      { productId: 1 },
      { productId: 2 },
      { productId: null },
    ];
    const { columns, prerenderedCells } = prerenderResourceCells<Record<string, unknown>>(
      defs,
      rows,
      reqCtx,
    );
    applyReferenceCells<Record<string, unknown>>(
      config,
      defs,
      columns,
      rows,
      prerenderedCells,
      new Map([
        [
          "productId",
          new Map([
            ["1", "Sony WH-1000XM5 Wireless Headphones"],
            ["2", "Kindle"],
          ]),
        ],
      ]),
    );
    expect(columns[0]?.textRem).toBe(
      Math.ceil(textRem("Sony WH-1000XM5 Wireless Headphones") * 4) / 4,
    );
  });
});
