import { metric } from "@flowpanel/kit";

export const paidToday = metric(
  "Paid today",
  { count: "invoices", where: { status: "paid" }, range: "paidAt" },
  { drilldown: { resource: "invoices", filter: { status: "paid" } } },
);
