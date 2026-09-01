import { type FieldDef, type InferRow, resource } from "@flowpanel/kit";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import type { AdminSession } from "@/src/demo/auth/session";
import { PRODUCT_STORIES } from "@/src/demo/data/scenarios";
import { requireSandboxId, sandboxField, sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { money } from "../../format";

const CATEGORIES = [...new Set(PRODUCT_STORIES.map((product) => product.category))].sort();
const sandboxPolicy = sandboxResourcePolicy(schema.products.sandboxId);

const fields: FieldDef<InferRow<typeof schema.products>>[] = [
  {
    name: "sku",
    label: "SKU",
    required: true,
    placeholder: "NWA-SONY-XM5",
    validate: (value) =>
      /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(String(value))
        ? null
        : "Use uppercase letters, numbers, and hyphens",
    span: 6,
    group: "Product",
  },
  { name: "brand", label: "Brand", span: 6, group: "Product" },
  { name: "title", label: "Product", required: true, group: "Product" },
  {
    name: "category",
    type: "select",
    options: CATEGORIES,
    defaultValue: "Electronics", // prefills the create form
    span: 6,
    group: "Product",
  },
  {
    name: "ourPriceCents",
    label: "Our price (cents)",
    type: "number",
    help: "Integer cents.",
    requireRole: "admin", // admin-only field — `support` never sees it
    span: 6,
    group: "Pricing & ownership",
  },
  {
    name: "customerId",
    label: "Customer",
    type: "reference",
    reference: { resource: "customers", labelField: "company" },
    required: true,
    group: "Pricing & ownership",
  },
];

export const products = resource(schema.products, {
  ...sandboxPolicy,
  name: "products",
  label: "Products",
  labelOne: "Product",
  icon: "package",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "title", label: "Product" },
    "brand",
    "category",
    { field: "ourPriceCents", label: "Our price", align: "right", format: money },
    {
      field: "customerId",
      label: "Customer",
      reference: { resource: "customers", labelField: "company" },
    },
  ],
  search: ["sku", "title", "brand"],
  filters: [
    {
      field: "customerId",
      type: "select",
      label: "Customer",
      options: async (ctx) =>
        (
          await db
            .select({ id: schema.customers.id, company: schema.customers.company })
            .from(schema.customers)
            .where(eq(schema.customers.sandboxId, requireSandboxId(ctx.session as AdminSession)))
            .orderBy(asc(schema.customers.company))
        ).map((customer) => ({
          label: customer.company ?? `Customer #${customer.id}`,
          value: String(customer.id),
        })),
    },
    { field: "category", type: "select", options: CATEGORIES },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  fieldAccess: {
    ...sandboxPolicy.fieldAccess,
    ourPriceCents: { read: "admin" },
  },
  create: { fields: [...fields, sandboxField<InferRow<typeof schema.products>>()] },
  update: { fields },
  delete: {
    confirm: "Permanently delete selected products and their matches? This cannot be undone.",
  },
  rowClick: "drawer",
  export: {
    formats: ["csv", "json"],
    fields: ["id", "sku", "title", "brand", "category", "ourPriceCents"],
  },
  drawer: {
    width: "lg",
    header: (row) => row.title,
    tabs: [
      {
        key: "detail",
        label: "Detail",
        fields: ["sku", "title", "brand", "category", "ourPriceCents", "createdAt"],
      },
      {
        key: "matches",
        label: "Matches",
        resource: "matches",
        filter: (row) => ({ productId: row.id }),
      },
    ],
  },
});
