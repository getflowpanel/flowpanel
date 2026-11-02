import { resource } from "@flowpanel/kit";
import { money, ratingCell } from "@/src/admin/format";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { Site, Stock } from "../enums";

export const listings = resource(schema.listings, {
  ...sandboxResourcePolicy(schema.listings.sandboxId),
  icon: "list",
  columns: [
    { field: "title", label: "Product" },
    { field: "site", label: "Marketplace", format: Site.format },
    { field: "priceCents", label: "Price", align: "right", format: money },
    { field: "stock", format: Stock.format },
    { field: "rating", align: "right", render: (row) => ratingCell(row.rating) },
    { field: "reviews", align: "right", format: "number" },
    { field: "scrapedAt", label: "Found" },
  ],
  search: ["title", "brand", "asin", "seller"],
  filters: [
    { field: "site", type: "select", label: "Marketplace" },
    { field: "stock", type: "select" },
    { field: "priceCents", type: "numeric-range", label: "Price" },
    { field: "scrapedAt", type: "daterange", label: "Found" },
  ],
  defaultSort: { field: "scrapedAt", dir: "desc" },
  density: "compact",
  create: { disabled: true },
  delete: {
    confirm: {
      one: "The listing and its matches are deleted for good. This cannot be undone.",
      other: "{n} listings and their matches are deleted for good. This cannot be undone.",
    },
  },
  rowClick: "drawer",
  export: {
    formats: ["csv", "json"],
    fields: ["id", "asin", "site", "title", "brand", "category", "priceCents", "stock"],
  },
  drawer: {
    width: "lg",
    title: (row) => row.title,
    tabs: [
      {
        key: "detail",
        label: "Details",
        fields: [
          "title",
          "site",
          "brand",
          "category",
          "priceCents",
          "currency",
          "seller",
          "stock",
          "rating",
          "reviews",
          "url",
          "scrapedAt",
        ],
      },
      {
        key: "match",
        label: "Match",
        resource: "matches",
        filter: (row) => ({ listingId: row.id }),
      },
    ],
  },
});
