import { type FieldDef, type RowOf, resource } from "@flowpanel/kit";
import { disableCustomer } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { readSandboxConfig } from "@/src/demo/sandbox/config";
import { sandboxField, sandboxImportConfig, sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { AccountStatus, Plan } from "../enums";
import { customerCard } from "./customer-card";

const fields: FieldDef<RowOf<"customers">>[] = [
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
    options: Plan.options,
    defaultValue: "starter",
    span: 6,
    group: "Subscription",
  },
  {
    name: "status",
    type: "select",
    options: AccountStatus.options,
    defaultValue: "trialing",
    span: 6,
    group: "Subscription",
  },
];

export const customers = resource(schema.customers, {
  ...sandboxResourcePolicy(schema.customers.sandboxId),
  icon: "users",
  columns: [
    { field: "company", editable: true },
    { field: "name", label: "Contact" },
    "email",
    { field: "plan", format: Plan.format },
    { field: "status", format: AccountStatus.format },
    { field: "createdAt", label: "Joined" },
  ],
  search: ["company", "name", "email"],
  filters: [
    { field: "plan", type: "select" },
    { field: "status", type: "select" },
    { field: "createdAt", type: "daterange", label: "Joined" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { fields: [...fields, sandboxField<RowOf<"customers">>()] },
  update: { fields },
  delete: { softDelete: "deletedAt" },
  detail: { expose: ["lastSeenAt"], ...customerCard },
  rowClick: "drawer",
  realtime: true,
  export: {
    formats: ["csv", "json"],
    fields: ["id", "company", "name", "email", "plan", "status", "createdAt"],
  },
  import: sandboxImportConfig(
    {
      formats: ["csv", "json"] as const,
      fields: ["company", "name", "email", "plan", "status"] as const,
    },
    readSandboxConfig().publicMode,
  ),
  empty: {
    icon: "users",
    title: "No customers yet",
    description: "Create a customer or import a catalog account from CSV.",
  },
  drawer: {
    width: "lg",
    title: (row) => row.company ?? row.email,
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
        access: "admin",
        confirm: "Disable this customer? They will lose access immediately.",
        run: disableCustomer,
      },
    ],
  },
});
