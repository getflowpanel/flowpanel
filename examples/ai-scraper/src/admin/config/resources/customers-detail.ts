import type { DetailTab, InferRow, StatResult, WidgetContext } from "@flowpanel/kit";
import { kv, stat } from "@flowpanel/kit";
import type * as schema from "@/src/db/schema";
import { labelOf, PLANS, STATUS_TONES, STATUSES } from "./customer-enums";

type Customer = InferRow<typeof schema.customers>;

function rowOf(ctx: WidgetContext): Partial<Customer> {
  return (ctx.row ?? {}) as Partial<Customer>;
}

const day = (value: Date | string | null | undefined): string =>
  value == null ? "—" : new Date(value).toISOString().slice(0, 10);

export const customerTitle = (row: Customer): string => row.company ?? row.email;

export const customerSubtitle = (row: Customer): string =>
  `${labelOf(PLANS, row.plan)} · ${labelOf(STATUSES, row.status)}`;

export const customerBadge = (row: Customer) => ({
  label: labelOf(STATUSES, row.status),
  tone: STATUS_TONES[row.status] ?? "default",
});

const account = kv({
  label: "Account",
  columns: 2,
  span: 12,
  items: [
    { label: "Company", value: async (ctx) => rowOf(ctx).company ?? "—" },
    { label: "Contact", value: async (ctx) => rowOf(ctx).name ?? "—" },
    { label: "Email", value: async (ctx) => rowOf(ctx).email ?? "—" },
    { label: "Plan", value: async (ctx) => labelOf(PLANS, rowOf(ctx).plan ?? "") },
    { label: "Status", value: async (ctx) => labelOf(STATUSES, rowOf(ctx).status ?? "") },
    { label: "Joined", value: async (ctx) => day(rowOf(ctx).createdAt) },
    { label: "Last seen", value: async (ctx) => day(rowOf(ctx).lastSeenAt) },
  ],
});

/** Each count links to the same rows it counted, filtered to this customer. */
async function relatedCount(
  resource: "monitors" | "products",
  ctx: WidgetContext,
): Promise<StatResult> {
  const id = rowOf(ctx).id;
  if (id === undefined) return { value: 0 };
  const filter = { customerId: id };
  return {
    value: await ctx.count(resource, filter),
    href: ctx.href(resource, undefined, { filter }),
  };
}

async function openInvoices(ctx: WidgetContext): Promise<StatResult> {
  const id = rowOf(ctx).id;
  if (id === undefined) return { value: 0 };
  const filter = { customerId: id, status: "open" };
  const value = await ctx.count("invoices", filter);
  return {
    value,
    ...(value > 0 ? { tone: "warn" as const } : {}),
    href: ctx.href("invoices", undefined, { filter }),
  };
}

/** Invoiced and settled, in dollars — one read-only statement per card. */
async function paidDollars(ctx: WidgetContext): Promise<StatResult> {
  const id = rowOf(ctx).id;
  if (id === undefined) return { value: 0 };
  const [row] = await ctx.sql<{ cents: number }>`
    select coalesce(sum(amount_cents), 0)::int as cents
    from invoices
    where customer_id = ${id} and status = 'paid'
  `;
  return {
    value: Number(row?.cents ?? 0) / 100,
    href: ctx.href("invoices", undefined, { filter: { customerId: id, status: "paid" } }),
  };
}

export const customerTabs: DetailTab<Customer>[] = [
  {
    key: "summary",
    label: "Summary",
    columns: 12,
    widgets: [
      account,
      stat("Monitors", (ctx) => relatedCount("monitors", ctx), { span: 3 }),
      stat("Products", (ctx) => relatedCount("products", ctx), { span: 3 }),
      stat("Open invoices", openInvoices, { span: 3 }),
      stat("Paid to date", paidDollars, { format: "currency", span: 3 }),
    ],
  },
  { key: "profile", label: "Profile", fields: "*" },
  {
    key: "monitors",
    label: "Monitors",
    resource: "monitors",
    filter: (row) => ({ customerId: row.id }),
    hide: ["customerId"],
    sort: { field: "lastRunAt", dir: "desc" },
  },
  {
    key: "invoices",
    label: "Invoices",
    resource: "invoices",
    filter: (row) => ({ customerId: row.id }),
    hide: ["customerId"],
    sort: { field: "createdAt", dir: "desc" },
  },
];
