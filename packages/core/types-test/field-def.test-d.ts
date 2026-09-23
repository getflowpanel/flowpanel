import type { FieldDef } from "@flowpanel/core";
import { expectAssignable, expectNotAssignable } from "tsd";

type Job = { id: string; categoryId: string };

expectAssignable<FieldDef<Job>>({
  name: "categoryId",
  label: "Category",
  render: async (row) => `Category ${row.categoryId}`,
});
expectNotAssignable<FieldDef<Job>>({ name: "categoryId", render: "text" });
