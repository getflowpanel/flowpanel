import { describe, it, expectTypeOf } from "vitest";
import type { WidgetContext, Adapter, InferDB } from "../index.js";

type MyDB = { query: (sql: string) => Promise<unknown> };

describe("WidgetContext generic", () => {
  it("preserves DB type from Adapter", () => {
    type Ctx = WidgetContext<MyDB>;
    expectTypeOf<Ctx["db"]>().toEqualTypeOf<MyDB>();
  });

  it("defaults DB to unknown for back-compat", () => {
    type Ctx = WidgetContext;
    expectTypeOf<Ctx["db"]>().toEqualTypeOf<unknown>();
  });

  it("Adapter is generic over DB", () => {
    type MyAdapter = Adapter<MyDB>;
    expectTypeOf<MyAdapter["db"]>().toEqualTypeOf<MyDB>();
  });
});

describe("FlowpanelTypes augmentation", () => {
  it("InferDB is unknown when FlowpanelTypes is empty", () => {
    expectTypeOf<InferDB>().toEqualTypeOf<unknown>();
  });

  it("WidgetContext defaults to InferDB", () => {
    type Ctx = WidgetContext;
    expectTypeOf<Ctx["db"]>().toEqualTypeOf<InferDB>();
  });

  it("Adapter defaults to InferDB", () => {
    type A = Adapter;
    expectTypeOf<A["db"]>().toEqualTypeOf<InferDB>();
  });
});
