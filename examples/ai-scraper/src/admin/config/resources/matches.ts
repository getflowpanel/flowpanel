import { resource } from "@flowpanel/kit";
import { eq } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { MATCH_MODELS, modelLabel } from "@/src/lib/ai-models";
import { badge, confidenceCell, formatDate, modelBadge } from "../format";

export const matches = resource(schema.matches, {
  label: "Review queue",
  labelOne: "Match",
  // Produced by the AI pipeline, so `create` is disabled below.
  columns: [
    {
      field: "listingId",
      label: "Listing",
      reference: { resource: "listings", labelField: "title" },
    },
    {
      field: "productId",
      label: "Catalog SKU",
      reference: { resource: "products", labelField: "sku" },
    },
    {
      field: "confidence",
      label: "Confidence",
      align: "right",
      render: (m) => confidenceCell(m.confidence),
    },
    { field: "model", label: "Model", render: (m) => modelBadge(m.model) },
    { field: "status", label: "Status", format: badge },
    { field: "matchedAt", label: "Matched", render: (m) => formatDate(m.matchedAt) },
  ],
  filters: [
    {
      field: "status",
      type: "select",
      label: "Status",
      options: [
        { label: "Needs review", value: "needs_review" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      field: "model",
      type: "select",
      label: "Model",
      options: MATCH_MODELS.map((m) => ({ label: modelLabel(m), value: m })),
    },
    { field: "confidence", type: "numeric-range", label: "Confidence" },
  ],
  // Lowest-confidence first — the matches most worth a human's eyes.
  defaultSort: { field: "confidence", dir: "asc" },
  views: [
    {
      name: "Needs review",
      description: "AI matches awaiting a human decision",
      filters: { status: "needs_review" },
      sort: { field: "confidence", dir: "asc" },
    },
    { name: "Auto-confirmed", filters: { status: "confirmed" } },
    { name: "Rejected", filters: { status: "rejected" } },
  ],
  create: { disabled: true },
  actions: [
    {
      key: "confirm",
      label: "Confirm match",
      hidden: (row) => row.status !== "needs_review",
      run: async (row, _input, ctx) => {
        await ctx.db
          .update(schema.matches)
          .set({
            status: "confirmed",
            reviewedAt: new Date(),
            reviewedBy: ctx.actorId ?? "unknown",
          })
          .where(eq(schema.matches.id, row.id));
        return { ok: true, message: "Match confirmed", refresh: true };
      },
    },
    {
      key: "reject",
      label: "Reject match",
      variant: "destructive",
      confirm: {
        title: "Reject this match?",
        description: "The listing won't be tracked against this SKU.",
      },
      hidden: (row) => row.status !== "needs_review",
      run: async (row, _input, ctx) => {
        await ctx.db
          .update(schema.matches)
          .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: ctx.actorId ?? "unknown" })
          .where(eq(schema.matches.id, row.id));
        return { ok: true, message: "Match rejected", refresh: true };
      },
    },
  ],
  rowClick: "drawer",
  drawer: {
    width: "md",
    header: (row) => `Match #${row.id}`,
    tabs: [
      {
        key: "detail",
        label: "Detail",
        fields: ["confidence", "status", "model", "matchedAt", "reviewedAt", "reviewedBy"],
      },
      {
        key: "listing",
        label: "Listing",
        resource: "listings",
        filter: (row) => ({ id: row.listingId }),
      },
      {
        key: "product",
        label: "Catalog SKU",
        resource: "products",
        filter: (row) => ({ id: row.productId }),
      },
    ],
  },
});
