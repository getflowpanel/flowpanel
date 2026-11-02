import type { ResourceConfig } from "@flowpanel/core";
import type { FlowpanelRequest } from "@flowpanel/next";
import { expectError } from "tsd";

type Orders = { id: string; total: number };
type Users = { id: string; email: string };
type OrdersTable = { _: { name: "orders" }; $inferSelect: Orders };
type UsersTable = { _: { name: "users" }; $inferSelect: Users };

declare const request: FlowpanelRequest<
  [
    ResourceConfig<OrdersTable, Orders>,
    ResourceConfig<UsersTable, Users>,
    ResourceConfig<{ __name: "audit" }, { id: string; at: Date }, { name: "log" }>,
  ]
>;

request.resources.orders.list({ select: ["total"] });
request.resources.users.list({ select: ["email"] });
request.resources.log.list({ select: ["at"] });
expectError(request.resources.orders.list({ select: ["email"] }));
