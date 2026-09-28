import { type ResourceIntrospection, type ResourceOptions, resource } from "@flowpanel/core";
import { expectAssignable, expectError } from "tsd";

declare const view: { $inferSelect: { id: string; lifecycle: string } };
declare const table: { $inferSelect: { id: string; internal: boolean } };

resource(view, { name: "user", writeTo: table, columns: ["id", "lifecycle"] });
expectAssignable<ResourceIntrospection>({ name: "v", kind: "view", columns: [], primaryKey: "id" });
expectAssignable<ResourceIntrospection>({ name: "t", columns: [], primaryKey: "id" });
expectError<ResourceIntrospection>({ name: "v", kind: "matview", columns: [], primaryKey: "id" });
expectAssignable<ResourceOptions<{ id: string }>>({ writeTo: table });
