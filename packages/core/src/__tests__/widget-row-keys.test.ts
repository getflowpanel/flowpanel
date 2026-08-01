import { describe, expectTypeOf, it } from "vitest";
import { table } from "../builders/widget.js";
import type { BarChartOptions, PieChartOptions, RowKey, TableWidgetOptions } from "../index.js";

type Row = { model: string; confidence: number };

describe("RowKey", () => {
  it("narrows to the row's string keys once the row type is known", () => {
    expectTypeOf<RowKey<Row>>().toEqualTypeOf<"model" | "confidence">();
  });

  it("stays a bare string while the row type is unknown", () => {
    expectTypeOf<RowKey<unknown>>().toEqualTypeOf<string>();
  });
});

describe("table()", () => {
  it("infers the row type from `query` and keys `columns` to it", () => {
    expectTypeOf<TableWidgetOptions<Row>["columns"]>().toEqualTypeOf<
      ("model" | "confidence")[] | undefined
    >();
  });

  it("accepts any column string when no `query` supplies a row type", () => {
    expectTypeOf<TableWidgetOptions["columns"]>().toEqualTypeOf<string[] | undefined>();
    const w = table({ resource: "runs", columns: ["id"], limit: 10 });
    expectTypeOf(w.kind).toEqualTypeOf<"table">();
  });
});

describe("chart options", () => {
  it("keys x/y to the row type", () => {
    expectTypeOf<BarChartOptions<Row>["x"]>().toEqualTypeOf<"model" | "confidence">();
    expectTypeOf<BarChartOptions<Row>["y"]>().toEqualTypeOf<
      "model" | "confidence" | ("model" | "confidence")[]
    >();
    expectTypeOf<PieChartOptions<Row>["category"]>().toEqualTypeOf<"model" | "confidence">();
    expectTypeOf<PieChartOptions<Row>["value"]>().toEqualTypeOf<"model" | "confidence">();
  });

  it("leaves x/y as strings when the row type is unknown", () => {
    expectTypeOf<BarChartOptions["x"]>().toEqualTypeOf<string>();
    expectTypeOf<BarChartOptions["y"]>().toEqualTypeOf<string | string[]>();
  });
});
