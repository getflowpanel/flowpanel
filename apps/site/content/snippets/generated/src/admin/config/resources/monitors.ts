import { enumOf, resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

const Status = enumOf(schema.monitorStatus.enumValues, { active: "Active", paused: "Paused", error: "Error" });

export const monitors = resource(schema.monitors, {
  columns: [
    "id",
    { field: "customerId", label: "Customer", reference: { resource: "customers", labelField: "email" } },
    "name",
    "targetUrl",
    { field: "status", format: Status.format },
    "errorRate",
    { field: "createdAt", format: { kind: "date", time: true } },
    { field: "lastRunAt", format: { kind: "date", time: true } },
  ],
  search: ["name"],
  filters: [{ field: "status", type: "select" }],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: {
    fields: [
      { name: "customerId", label: "Customer", reference: { resource: "customers", labelField: "email" } },
      { name: "name" },
      { name: "targetUrl" },
      { name: "status", type: "select", options: Status.options },
      { name: "errorRate", type: "number" },
      { name: "createdAt", type: "datetime" },
      { name: "lastRunAt", type: "datetime" },
    ],
  },
});
