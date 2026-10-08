import { type RowOf, resource, rowAction } from "@flowpanel/kit";
import { formatMonth, money } from "@/src/admin/format";
import { refundPaidInvoice } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { InvoiceStatus } from "../enums";

type Invoice = RowOf<"invoices">;
type RefundInput = { reason: string };

const refund = rowAction<Invoice, RefundInput>({
  key: "refund",
  label: "Refund",
  icon: "circle-dollar-sign",
  variant: "destructive",
  confirm: {
    title: "Refund this invoice?",
    description: "Issues a Stripe refund, then marks the invoice refunded.",
  },
  form: [
    {
      name: "reason",
      label: "Reason",
      type: "textarea",
      placeholder: "Duplicate charge, service issue…",
      required: true,
    },
  ],
  hidden: (row) => row.status !== "paid",
  run: refundPaidInvoice,
});

export const invoices = resource(schema.invoices, {
  ...sandboxResourcePolicy(schema.invoices.sandboxId),
  icon: "credit-card",
  hidden: true,
  columns: [
    {
      field: "customerId",
      label: "Customer",
      reference: { resource: "customers", labelField: "company" },
    },
    { field: "amountCents", label: "Amount", align: "right", format: money },
    { field: "status", format: InvoiceStatus.format },
    { field: "periodStart", label: "Period", render: (i) => formatMonth(i.periodStart) },
    { field: "createdAt", label: "Created" },
  ],
  filters: [
    { field: "status", type: "select" },
    { field: "paidAt", type: "daterange", label: "Paid" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { disabled: true },
  update: { disabled: true },
  actions: [refund],
  rowClick: "drawer",
  drawer: {
    width: "md",
    title: (row) => `Invoice #${row.id}`,
    tabs: [
      {
        key: "detail",
        label: "Detail",
        fields: [
          "amountCents",
          "status",
          "stripeId",
          "periodStart",
          "periodEnd",
          "paidAt",
          "createdAt",
        ],
      },
      {
        key: "customer",
        label: "Customer",
        resource: "customers",
        filter: (row) => ({ id: row.customerId }),
      },
    ],
  },
});
