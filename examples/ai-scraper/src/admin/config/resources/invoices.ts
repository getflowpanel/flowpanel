import { resource, rowAction } from "@flowpanel/kit";
import { badge, formatMonth, money } from "@/src/admin/format";
import { refundPaidInvoice } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";

type Invoice = typeof schema.invoices.$inferSelect;
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
  name: "invoices",
  label: "Invoices",
  labelOne: "Invoice",
  icon: "credit-card",
  hidden: true,
  columns: [
    {
      field: "customerId",
      label: "Customer",
      reference: { resource: "customers", labelField: "company" },
    },
    { field: "amountCents", label: "Amount", align: "right", format: money },
    { field: "status", format: badge },
    { field: "periodStart", label: "Period", render: (i) => formatMonth(i.periodStart) },
    { field: "createdAt", label: "Created" },
  ],
  filters: [
    {
      field: "status",
      type: "select",
      options: [
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "Void", value: "void" },
        { label: "Refunded", value: "refunded" },
      ],
    },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { disabled: true },
  update: { disabled: true },
  actions: [refund],
  rowClick: "drawer",
  drawer: {
    width: "md",
    header: (row) => `Invoice #${row.id}`,
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
