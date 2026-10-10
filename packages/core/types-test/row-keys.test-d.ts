import { type ResourceOptions, resource } from "@flowpanel/core";
import { expectError, expectType } from "tsd";

type Row = { id: number; name: string; 7: string };
declare const rows: { $inferSelect: Row };

resource(rows, { columns: ["id", "name"], filters: ["name"] });
expectError(resource(rows, { columns: [7] }));
expectError(resource(rows, { filters: [7] }));

type Column = NonNullable<ResourceOptions<Row>["columns"]>[number];
type Filter = NonNullable<ResourceOptions<Row>["filters"]>[number];
expectType<"id" | "name">({} as Extract<Column, string>);
expectType<"id" | "name">({} as Extract<Filter, string>);
