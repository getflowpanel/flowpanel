import { resource } from "@flowpanel/kit";
import { formatDuration } from "@/src/admin/format";
import { retryFailedRun } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { RunStatus } from "../enums";

export const runs = resource(schema.runs, {
  ...sandboxResourcePolicy(schema.runs.sandboxId),
  icon: "refresh",
  columns: [
    {
      field: "monitorId",
      label: "Monitor",
      reference: { resource: "monitors", labelField: "name" },
    },
    { field: "status", format: RunStatus.format },
    { field: "pagesCrawled", label: "Pages", align: "right" },
    { field: "itemsExtracted", label: "Items", align: "right" },
    {
      field: "durationMs",
      label: "Duration",
      align: "right",
      render: (r) => formatDuration(r.durationMs),
    },
    { field: "startedAt", label: "Started" },
  ],
  filters: [
    { field: "status", type: "multiselect" },
    { field: "startedAt", type: "daterange" },
  ],
  defaultSort: { field: "startedAt", dir: "desc" },
  create: { disabled: true },
  delete: { disabled: true },
  actions: [
    {
      key: "retry",
      label: "Retry run",
      icon: "refresh",
      confirm: {
        title: "Retry this run?",
        description: "Re-enqueues the scrape job. The run resets to queued.",
      },
      hidden: (row) => row.status !== "failed",
      run: retryFailedRun,
    },
  ],
  export: {
    formats: ["csv"],
    fields: ["id", "monitorId", "status", "pagesCrawled", "itemsExtracted", "startedAt"],
  },
  rowClick: "drawer",
  drawer: {
    width: "lg",
    title: (row) => `Run #${row.id}`,
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
