import { resource } from "@flowpanel/kit";
import { eq } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { refundInvoice } from "@/src/lib/billing";
import { badge, formatDate, money } from "../format";

export const invoices = resource(schema.invoices, {
  label: "Invoices",
  // Out of the top nav — reached via the Customers drawer's Invoices tab.
  hidden: true,
  columns: [
    {
      field: "userId",
      label: "Customer",
      reference: { resource: "users", labelField: "email" },
    },
    { field: "amountCents", label: "Amount", align: "right", format: money },
    { field: "status", label: "Status", format: badge },
    { field: "periodStart", label: "Period", render: (i) => formatDate(i.periodStart) },
    { field: "createdAt", label: "Created", render: (i) => formatDate(i.createdAt) },
  ],
  filters: [
    {
      field: "status",
      type: "select",
      label: "Status",
      options: [
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "Void", value: "void" },
        { label: "Refunded", value: "refunded" },
      ],
    },
    { field: "amountCents", type: "numeric-range", label: "Amount (cents)" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  actions: [
    {
      key: "refund",
      label: "Refund",
      variant: "destructive",
      confirm: {
        title: "Refund this invoice?",
        description: "Issues a Stripe refund, then marks the invoice refunded.",
      },
      hidden: (row) => row.status !== "paid",
      run: async (row, _input, ctx) => {
        await refundInvoice(row.stripeId);
        await ctx.db
          .update(schema.invoices)
          .set({ status: "refunded" })
          .where(eq(schema.invoices.id, row.id));
        return { ok: true, message: "Invoice refunded", refresh: true };
      },
    },
  ],
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
        resource: "users",
        filter: (row) => ({ id: row.userId }),
      },
    ],
  },
});
