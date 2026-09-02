import {
  type Adapter,
  type AdminDefinition,
  type ColumnDef,
  defineAdmin,
  type FlowpanelErrorCode,
  type FlowpanelResult,
  resource,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectType } from "tsd";

interface Customer {
  id: string;
  email: string;
  plan: "starter" | "growth";
}

declare const customersTable: { $inferSelect: Customer };
declare const adapter: Adapter;

const customers = resource(customersTable, {
  name: "customers",
  columns: ["email", "plan"],
});

expectType<"customers">(customers.options.name);
expectAssignable<keyof Customer | ColumnDef<Customer> | undefined>(customers.options.columns?.[0]);
expectError(resource(customersTable, { name: "broken", columns: ["emial"] }));

const admin = defineAdmin({
  id: "acme-ops",
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  paths: { admin: "/admin", api: "/api/flowpanel" },
  resources: [customers] as const,
});

expectType<readonly [typeof customers]>(admin.resources);
expectType<string>(admin.paths.admin);
expectType<string>(admin.paths.api);
expectAssignable<AdminDefinition<readonly [typeof customers]>>(admin);

declare const result: FlowpanelResult<Customer>;
if (result.ok) {
  expectType<Customer>(result.data);
  expectType<string>(result.meta.requestId);
} else {
  expectType<FlowpanelErrorCode>(result.error.code);
  expectType<string | undefined>(result.error.requestId);
}
