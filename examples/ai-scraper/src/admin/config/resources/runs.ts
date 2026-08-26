import { resource } from "@flowpanel/kit";
import { retryFailedRun } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { badge, formatDate, formatDuration } from "../../format";

export const runs = resource(schema.runs, {
  name: "runs",
  label: "Runs",
  labelOne: "Run",
  icon: "refresh",
  columns: [
    {
      field: "monitorId",
      label: "Monitor",
      reference: { resource: "monitors", labelField: "name" },
    },
    { field: "status", format: badge },
    { field: "pagesCrawled", label: "Pages", align: "right" },
    { field: "itemsExtracted", label: "Offers", align: "right" },
    {
      field: "durationMs",
      align: "right",
      render: (r) => formatDuration(r.durationMs),
    },
    { field: "startedAt", label: "Started", render: (r) => formatDate(r.startedAt) },
  ],
  filters: [
    {
      field: "status",
      type: "multiselect",
      options: [
        { label: "Queued", value: "queued" },
        { label: "Running", value: "running" },
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
      ],
    },
    { field: "startedAt", type: "daterange" },
  ],
  defaultSort: { field: "startedAt", dir: "desc" },
  create: { disabled: true },
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
        label: "Offers",
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
