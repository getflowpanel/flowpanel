import { resource } from "@flowpanel/kit";
import * as schema from "@/src/db/schema";
import { MARKETPLACES } from "@/src/demo/data/types";
import { badge, money, ratingCell } from "../../format";

export const offers = resource(schema.listings, {
  name: "listings",
  label: "Offers",
  labelOne: "Offer",
  icon: "list",
  columns: [
    { field: "title", label: "Product" },
    { field: "site", label: "Marketplace", format: "badge" },
    { field: "priceCents", label: "Price", align: "right", format: money },
    { field: "stock", format: badge },
    { field: "rating", align: "right", render: (row) => ratingCell(row.rating) },
    { field: "reviews", align: "right", format: "number" },
    { field: "scrapedAt", label: "Discovered" },
  ],
  search: ["title", "brand", "asin", "seller"],
  filters: [
    {
      field: "site",
      type: "select",
      label: "Marketplace",
      options: MARKETPLACES.map((site) => ({ label: site, value: site })),
    },
    {
      field: "stock",
      type: "select",
      options: [
        { label: "In stock", value: "in_stock" },
        { label: "Low stock", value: "low_stock" },
        { label: "Out of stock", value: "out_of_stock" },
      ],
    },
    { field: "priceCents", type: "numeric-range", label: "Price (cents)" },
  ],
  defaultSort: { field: "scrapedAt", dir: "desc" },
  density: "compact",
  create: { disabled: true },
  rowClick: "drawer",
  export: {
    formats: ["csv", "json"],
    fields: ["id", "asin", "site", "title", "brand", "category", "priceCents", "stock"],
  },
  drawer: {
    width: "lg",
    header: (row) => row.title,
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
