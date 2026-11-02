import type { FieldDef } from "@flowpanel/core";
import { expectAssignable, expectNotAssignable } from "tsd";

type Job = { id: string; categoryId: string };

expectAssignable<FieldDef<Job>>({
  name: "categoryId",
  label: "Category",
  render: async (row) => `Category ${row.categoryId}`,
});
expectNotAssignable<FieldDef<Job>>({ name: "categoryId", render: "text" });

expectAssignable<FieldDef<Job>>({
  name: "categoryId",
  defaultValue: async (ctx) => (ctx.role === "admin" ? "all" : ctx.scope?.categoryId),
});
expectAssignable<FieldDef<Job>>({ name: "categoryId", defaultValue: "general" });
expectAssignable<FieldDef<Job>>({ name: "categoryId", defaultValue: new Map([["a", 1]]) });
expectAssignable<FieldDef<Job>>({ name: "categoryId", defaultValue: ["a", "b"] });
