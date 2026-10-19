import {
  type DetailOptions,
  kv,
  metric,
  type RowOf,
  related,
  type StatResult,
  stat,
  type WidgetContext,
} from "@flowpanel/kit";
import { requireSandboxId } from "@/src/demo/sandbox/scope";
import { AccountStatus, Plan } from "../enums";

type Customer = RowOf<"customers">;

export const openInvoices = metric(
  "Open invoices",
  { count: "invoices", where: { status: "open" } },
  { tones: { warn: 1, err: 2 }, goodWhen: "down" },
);

async function paidToDate(c: WidgetContext): Promise<StatResult> {
  const { id } = c.rowOf("customers");
  const [row] = await c.sql<{ cents: number }>`
    select coalesce(sum(amount_cents), 0)::int as cents
    from invoices
    where sandbox_id = ${requireSandboxId(c.session)} and customer_id = ${id} and status = 'paid'`;
  return {
    value: Number(row?.cents ?? 0) / 100,
    href: { resource: "invoices", filter: { customerId: id, status: "paid" } },
  };
}

export const customerCard = {
  title: (c) => c.company ?? c.email,
  subtitle: (c, { format }) => `Customer since ${format.date(c.createdAt)}`,
  badge: (c) => [
    AccountStatus.badge(c.status, {
      href: { resource: "customers", filter: { status: c.status } },
    }),
    Plan.badge(c.plan),
  ],
  stats: [
    metric("Monitors", { count: "monitors" }),
    metric("Products", { count: "products" }),
    openInvoices,
    stat("Paid to date", paidToDate, { format: "currency" }),
  ],
  aside: [
    kv<Customer>({
      label: "Account",
      columns: 1,
      items: [
        { label: "Contact", field: "name" },
        { label: "Email", field: "email" },
        { label: "Plan", field: "plan", format: Plan.format },
        { label: "Last seen", field: "lastSeenAt", format: "relative" },
      ],
    }),
  ],
  tabs: [
    related("monitors", { sort: { field: "lastRunAt", dir: "desc" } }),
    related("products"),
    related("invoices", { sort: { field: "createdAt", dir: "desc" } }),
  ],
} satisfies DetailOptions<Customer>;
