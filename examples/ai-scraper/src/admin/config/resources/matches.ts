import { resource } from "@flowpanel/kit";
import { confidenceCell, modelBadge } from "@/src/admin/format";
import { confirmMatch, rejectMatch } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { MATCH_MODELS, modelLabel } from "@/src/lib/ai-models";
import { MatchStatus } from "../enums";

export const matches = resource(schema.matches, {
  ...sandboxResourcePolicy(schema.matches.sandboxId),
  icon: "sparkles",
  columns: [
    {
      field: "productId",
      label: "Catalog product",
      reference: { resource: "products", labelField: "title" },
    },
    {
      field: "listingId",
      label: "Listing",
      reference: { resource: "listings", labelField: "title" },
    },
    {
      field: "confidence",
      label: "Confidence",
      align: "right",
      render: (row) => confidenceCell(row.confidence),
    },
    { field: "status", format: MatchStatus.format },
    { field: "model", render: (row) => modelBadge(row.model) },
    { field: "matchedAt", label: "Matched" },
  ],
  filters: [
    { field: "status", type: "select" },
    {
      field: "model",
      type: "select",
      options: MATCH_MODELS.map((model) => ({ label: modelLabel(model), value: model })),
    },
    { field: "confidence", type: "numeric-range" },
    { field: "matchedAt", type: "daterange", label: "Matched" },
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
  delete: {
    confirm: "Permanently delete selected review decisions? This cannot be undone.",
  },
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
        description: "This listing will no longer be tracked against the catalog product.",
      },
      hidden: (row) => row.status !== "needs_review",
      run: rejectMatch,
    },
  ],
  rowClick: "drawer",
  drawer: {
    width: "lg",
    title: (row) => `Match #${row.id}`,
    tabs: [
      {
        key: "decision",
        label: "Decision",
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
        label: "Catalog product",
        resource: "products",
        filter: (row) => ({ id: row.productId }),
      },
    ],
  },
});
