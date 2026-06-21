import { type FieldDef, type InferRow, resource } from "@flowpanel/kit";
import * as schema from "@/src/db/schema";
import { money } from "../format";

const CATEGORIES = [
  "Electronics",
  "Computers",
  "Phones",
  "Fashion",
  "Home & Kitchen",
  "Jewelry",
  "Toys & Games",
];

// The create / edit form is driven entirely by these field specs — `select`
// reads `options`, `reference` resolves a Customer picker from the users table,
// and `requireRole` gates a field server-side: `support` staff never see or can
// write `ourPriceCents` (our internal cost), only `admin` does.
const fields: FieldDef<InferRow<typeof schema.products>>[] = [
  // `group` renders fields under section headings; `span` lays them out on a
  // 12-column grid (full width on mobile). SKU and Brand share a row.
  {
    name: "sku",
    label: "SKU",
    required: true,
    placeholder: "SKU-12345",
    // Custom rule — runs server-side after schema validation.
    validate: (v) => (/^SKU-\d+$/.test(String(v)) ? null : "Format: SKU-12345"),
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
    name: "userId",
    label: "Customer",
    type: "reference",
    reference: { resource: "users", labelField: "email" },
    required: true,
    group: "Pricing & ownership",
  },
];

export const products = resource(schema.products, {
  label: "Catalog",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "title", label: "Product" },
    "brand",
    "category",
    { field: "ourPriceCents", label: "Our price", align: "right", format: money },
    {
      field: "userId",
      label: "Customer",
      reference: { resource: "users", labelField: "email" },
    },
  ],
  search: ["sku", "title", "brand"],
  filters: [{ field: "category", type: "select", label: "Category", options: CATEGORIES }],
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
