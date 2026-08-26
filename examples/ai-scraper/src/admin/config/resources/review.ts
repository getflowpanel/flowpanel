import { resource } from "@flowpanel/kit";
import { confirmMatch, rejectMatch } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { MATCH_MODELS, modelLabel } from "@/src/lib/ai-models";
import { badge, confidenceCell, modelBadge } from "../../format";

export const review = resource(schema.matches, {
  name: "matches",
  label: "Review",
  labelOne: "Match",
  icon: "sparkles",
  columns: [
    {
      field: "productId",
      label: "Catalog product",
      reference: { resource: "products", labelField: "title" },
    },
    {
      field: "listingId",
      label: "Marketplace offer",
      reference: { resource: "listings", labelField: "title" },
    },
    {
      field: "confidence",
      label: "Confidence",
      align: "right",
      render: (row) => confidenceCell(row.confidence),
    },
    { field: "status", format: badge },
    { field: "model", render: (row) => modelBadge(row.model) },
    { field: "matchedAt", label: "Matched" },
  ],
  filters: [
    {
      field: "status",
      type: "select",
      options: [
        { label: "Needs review", value: "needs_review" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      field: "model",
      type: "select",
      options: MATCH_MODELS.map((model) => ({ label: modelLabel(model), value: model })),
    },
    { field: "confidence", type: "numeric-range" },
  ],
  defaultSort: { field: "confidence", dir: "asc" },
  views: [
    {
      name: "Needs review",
      description: "Ambiguous matches waiting for a human decision",
      filters: { status: "needs_review" },
      sort: { field: "confidence", dir: "asc" },
    },
    { name: "Confirmed", filters: { status: "confirmed" } },
    { name: "Rejected", filters: { status: "rejected" } },
  ],
  create: { disabled: true },
  actions: [
    {
      key: "confirm",
      label: "Confirm match",
      icon: "check",
      hidden: (row) => row.status !== "needs_review",
      run: confirmMatch,
    },
    {
      key: "reject",
      label: "Reject match",
      icon: "x",
      variant: "destructive",
      confirm: {
        title: "Reject this match?",
        description: "This offer will no longer be tracked against the catalog product.",
      },
      hidden: (row) => row.status !== "needs_review",
      run: rejectMatch,
    },
  ],
  rowClick: "drawer",
  drawer: {
    width: "lg",
    header: (row) => `Match #${row.id}`,
    tabs: [
      {
        key: "decision",
        label: "Decision",
        fields: ["confidence", "status", "model", "matchedAt", "reviewedAt", "reviewedBy"],
      },
      {
        key: "offer",
        label: "Marketplace offer",
        resource: "listings",
        filter: (row) => ({ id: row.listingId }),
      },
      {
        key: "product",
        label: "Catalog product",
        resource: "products",
        filter: (row) => ({ id: row.productId }),
      },
    ],
  },
});
