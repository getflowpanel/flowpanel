import { type FieldDef, type InferRow, resource } from "@flowpanel/kit";
import { disableCustomer } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { badge, formatDate } from "../../format";

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

const fields: FieldDef<InferRow<typeof schema.customers>>[] = [
  {
    name: "email",
    type: "email",
    required: true,
    placeholder: "ops@customer.com",
    validate: (value) =>
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value)) ? null : "Enter a valid email",
    span: 6,
    group: "Account",
  },
  { name: "name", label: "Contact", placeholder: "Jane Doe", span: 6, group: "Account" },
  { name: "company", label: "Company", placeholder: "Northwind Audio", group: "Account" },
  {
    name: "plan",
    type: "select",
    options: PLANS,
    defaultValue: "starter",
    span: 6,
    group: "Subscription",
  },
  {
    name: "status",
    type: "select",
    options: STATUSES,
    defaultValue: "trialing",
    span: 6,
    group: "Subscription",
  },
];

export const customers = resource(schema.customers, {
  name: "customers",
  label: "Customers",
  labelOne: "Customer",
  icon: "users",
  columns: [
    { field: "company", editable: true },
    { field: "name", label: "Contact" },
    "email",
    { field: "plan", format: badge },
    { field: "status", format: badge },
    { field: "createdAt", label: "Joined", render: (row) => formatDate(row.createdAt) },
  ],
  search: ["company", "name", "email"],
  filters: [
    { field: "plan", type: "select", options: PLANS },
    { field: "status", type: "select", options: STATUSES },
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
    fields: ["id", "company", "name", "email", "plan", "status", "createdAt"],
  },
  import: {
    formats: ["csv", "json"],
    fields: ["company", "name", "email", "plan", "status"],
  },
  empty: {
    icon: "users",
    title: "No customers yet",
    description: "Create a customer or import a catalog account from CSV.",
    action: { label: "Create customer", href: "/admin/customers/new" },
  },
  drawer: {
    width: "lg",
    header: (row) => row.company ?? row.email,
    tabs: [
      { key: "profile", label: "Profile", fields: "*" },
      {
        key: "monitors",
        label: "Monitors",
        resource: "monitors",
        filter: (row) => ({ customerId: row.id }),
      },
      {
        key: "products",
        label: "Products",
        resource: "products",
        filter: (row) => ({ customerId: row.id }),
      },
      {
        key: "invoices",
        label: "Invoices",
        resource: "invoices",
        filter: (row) => ({ customerId: row.id }),
      },
    ],
    actions: [
      {
        key: "disable",
        label: "Disable customer",
        variant: "destructive",
        requireRole: "admin",
        confirm: "Disable this customer? They will lose access immediately.",
        run: disableCustomer,
      },
    ],
  },
});
