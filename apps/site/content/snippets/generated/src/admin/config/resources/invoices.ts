import { enumOf, resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

const Status = enumOf(schema.invoiceStatus.enumValues, { open: "Open", paid: "Paid", void: "Void", refunded: "Refunded" });

export const invoices = resource(schema.invoices, {
  hidden: true,
  columns: [
    "id",
    { field: "customerId", label: "Customer", reference: { resource: "customers", labelField: "email" } },
    { field: "amountCents", format: { kind: "money", minorUnits: 2 } },
    { field: "status", format: Status.format },
    { field: "paidAt", format: { kind: "date", time: true } },
    { field: "createdAt", format: { kind: "date", time: true } },
  ],
  filters: [{ field: "status", type: "select" }],
  defaultSort: { field: "createdAt", dir: "desc" },
});
