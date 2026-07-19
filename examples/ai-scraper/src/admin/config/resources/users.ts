import { type FieldDef, type InferRow, resource } from "@flowpanel/kit";
import { eq } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { badge, formatDate } from "../format";

const PLANS = [
  { label: "Free", value: "free" },
  { label: "Starter", value: "starter" },
  { label: "Pro", value: "pro" },
  { label: "Business", value: "business" },
];

const STATUSES = [
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past due", value: "past_due" },
  { label: "Canceled", value: "canceled" },
];

// Explicit specs, so the form never introspects `deletedAt` (soft-delete is the
// "Disable user" action's job) or renders an enum column as free text.
const fields: FieldDef<InferRow<typeof schema.users>>[] = [
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    placeholder: "ops@customer.com",
    validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : "Not an email address"),
    span: 6,
    group: "Account",
  },
  { name: "name", label: "Name", placeholder: "Jane Doe", span: 6, group: "Account" },
  { name: "company", label: "Company", placeholder: "Northwind Labs", group: "Account" },
  {
    name: "plan",
    label: "Plan",
    type: "select",
    options: PLANS,
    defaultValue: "free",
    span: 6,
    group: "Subscription",
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: STATUSES,
    defaultValue: "trialing",
    help: "Trialing until the first invoice is paid.",
    span: 6,
    group: "Subscription",
  },
];

export const users = resource(schema.users, {
  label: "Customers",
  columns: [
    "email",
    "name",
    { field: "company", label: "Company", render: (u) => u.company ?? "—" },
    { field: "plan", label: "Plan", format: badge },
    { field: "status", label: "Status", format: badge },
    { field: "createdAt", label: "Joined", render: (u) => formatDate(u.createdAt) },
  ],
  search: ["email", "name", "company"],
  filters: [
    { field: "plan", type: "select", label: "Plan", options: PLANS },
    { field: "status", type: "select", label: "Status", options: STATUSES },
    { field: "createdAt", type: "daterange", label: "Joined" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { fields },
  update: { fields },
  delete: { softDelete: "deletedAt" },
  rowClick: "drawer",
  realtime: true,
  export: {
    formats: ["csv", "json"],
    fields: ["id", "email", "name", "company", "plan", "status", "createdAt"],
  },
  import: {
    formats: ["csv", "json"],
    fields: ["email", "name", "company", "plan", "status"],
  },
  drawer: {
    width: "lg",
    header: (row) => row.email,
    tabs: [
      { key: "profile", label: "Profile", fields: "*" },
      {
        key: "scrapers",
        label: "Scrapers",
        resource: "scrapers",
        filter: (row) => ({ userId: row.id }),
      },
      {
        key: "invoices",
        label: "Invoices",
        resource: "invoices",
        filter: (row) => ({ userId: row.id }),
      },
    ],
    actions: [
      {
        key: "disable",
        label: "Disable user",
        variant: "destructive",
        confirm: "Disable this user? They'll lose access immediately.",
        run: async (row, _input, ctx) => {
          await ctx.db
            .update(schema.users)
            .set({ deletedAt: new Date() })
            .where(eq(schema.users.id, row.id));
          return { ok: true, message: `Disabled ${row.email}`, refresh: true };
        },
      },
    ],
  },
});
