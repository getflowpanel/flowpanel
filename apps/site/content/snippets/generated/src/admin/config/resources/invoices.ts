import { enumOf, resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

const Status = enumOf(schema.invoiceStatus.enumValues, { open: "Open", paid: "Paid", void: "Void", refunded: "Refunded" });

export const invoices = resource(schema.invoices, {
  hidden: true,
  columns: [
    "id",
    { field: "customerId", label: "Customer", reference: { resource: "customers", labelField: "email" } },
    "amountCents",
    { field: "status", format: Status.format },
    { field: "paidAt", format: { kind: "date", time: true } },
    { field: "createdAt", format: { kind: "date", time: true } },
  ],
  filters: [{ field: "status", type: "select" }],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: {
    fields: [
      { name: "customerId", label: "Customer", reference: { resource: "customers", labelField: "email" } },
      { name: "amountCents", type: "number" },
      { name: "status", type: "select", options: Status.options },
      { name: "paidAt", type: "datetime" },
      { name: "createdAt", type: "datetime" },
    ],
  },
});
