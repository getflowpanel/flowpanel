import { type FieldDef, type InferRow, resource } from "@flowpanel/kit";
import { asc } from "drizzle-orm";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { PRODUCT_STORIES } from "@/src/demo/data/scenarios";
import { money } from "../../format";

const CATEGORIES = [...new Set(PRODUCT_STORIES.map((product) => product.category))].sort();

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
      options: async () =>
        (
          await db
            .select({ id: schema.customers.id, company: schema.customers.company })
            .from(schema.customers)
            .orderBy(asc(schema.customers.company))
        ).map((customer) => ({
          label: customer.company ?? `Customer #${customer.id}`,
          value: String(customer.id),
        })),
    },
    { field: "category", type: "select", options: CATEGORIES },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { fields },
  update: { fields },
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
