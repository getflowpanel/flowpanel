import { resource } from "@flowpanel/kit";
import { eq } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { retryRun } from "@/src/lib/runner";
import { badge, formatDate, formatDuration } from "../format";

export const runs = resource(schema.runs, {
  label: "Runs",
  columns: [
    {
      field: "scraperId",
      label: "Scraper",
      reference: { resource: "scrapers", labelField: "name" },
    },
    { field: "status", label: "Status", format: badge },
    { field: "pagesCrawled", label: "Pages", align: "right" },
    { field: "itemsExtracted", label: "Listings", align: "right" },
    {
      field: "durationMs",
      label: "Duration",
      align: "right",
      render: (r) => formatDuration(r.durationMs),
    },
    { field: "startedAt", label: "Started", render: (r) => formatDate(r.startedAt) },
  ],
  filters: [
    {
      field: "status",
      type: "multiselect",
      label: "Status",
      options: [
        { label: "Queued", value: "queued" },
        { label: "Running", value: "running" },
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
      ],
    },
    { field: "startedAt", type: "daterange", label: "Started" },
  ],
  defaultSort: { field: "startedAt", dir: "desc" },
  create: { disabled: true },
  actions: [
    {
      key: "retry",
      label: "Retry run",
      confirm: {
        title: "Retry this run?",
        description: "Re-enqueues the scrape job. The run resets to queued.",
      },
      hidden: (row) => row.status !== "failed",
      run: async (row, _input, ctx) => {
        await retryRun(row.id);
        await ctx.db
          .update(schema.runs)
          .set({ status: "queued", error: null, finishedAt: null })
          .where(eq(schema.runs.id, row.id));
        return { ok: true, message: "Run re-queued", refresh: true };
      },
    },
  ],
  export: {
    formats: ["csv"],
    fields: ["id", "scraperId", "status", "pagesCrawled", "itemsExtracted", "startedAt"],
  },
  rowClick: "drawer",
  drawer: {
    width: "lg",
    header: (row) => `Run #${row.id}`,
    tabs: [
      {
        key: "detail",
        label: "Detail",
        fields: [
          "status",
          "pagesCrawled",
          "itemsExtracted",
          "durationMs",
          "startedAt",
          "finishedAt",
          "error",
        ],
      },
      {
        key: "listings",
        label: "Listings",
        resource: "listings",
        filter: (row) => ({ runId: row.id }),
      },
      {
        key: "ai",
        label: "AI usage",
        resource: "ai_usage",
        filter: (row) => ({ runId: row.id }),
      },
    ],
  },
});
