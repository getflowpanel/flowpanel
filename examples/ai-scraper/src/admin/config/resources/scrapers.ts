import { type BulkAction, resource } from "@flowpanel/kit";
import { inArray } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { badge, formatDate } from "../format";

type Scraper = typeof schema.scrapers.$inferSelect;

/** Pause/resume are the same bulk write with a different status + verb. */
const setStatus =
  (status: "active" | "paused", verb: string): BulkAction<Scraper>["run"] =>
  async (ids, _input, { db }) => {
    const numericIds = ids.map(Number).filter(Number.isFinite);
    await db.update(schema.scrapers).set({ status }).where(inArray(schema.scrapers.id, numericIds));
    return { ok: true, message: `${verb} ${ids.length}`, refresh: true };
  };

export const scrapers = resource(schema.scrapers, {
  label: "Scrapers",
  // Out of the top nav — reached via the Customers drawer and Run/Listing references.
  hidden: true,
  columns: [
    { field: "name", label: "Name", editable: true },
    {
      field: "userId",
      label: "Customer",
      reference: { resource: "users", labelField: "email" },
    },
    "targetUrl",
    "schedule",
    { field: "status", label: "Status", format: badge },
    { field: "lastRunAt", label: "Last run", render: (s) => formatDate(s.lastRunAt) },
  ],
  search: ["name", "targetUrl"],
  filters: [
    {
      field: "status",
      type: "select",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Error", value: "error" },
      ],
    },
    {
      field: "schedule",
      type: "select",
      label: "Schedule",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Hourly", value: "hourly" },
        { label: "Daily", value: "daily" },
        { label: "Weekly", value: "weekly" },
      ],
    },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  bulkActions: [
    {
      key: "pause",
      label: "Pause selected",
      confirm: {
        title: "Pause selected scrapers?",
        description: "They stop running on schedule until resumed.",
      },
      run: setStatus("paused", "Paused"),
    },
    {
      key: "resume",
      label: "Resume selected",
      confirm: {
        title: "Resume selected scrapers?",
        description: "They return to their schedule.",
      },
      run: setStatus("active", "Resumed"),
    },
  ],
  rowClick: "drawer",
  drawer: {
    width: "lg",
    header: (row) => row.name,
    tabs: [
      {
        key: "detail",
        label: "Detail",
        fields: ["name", "targetUrl", "schedule", "status", "lastRunAt", "createdAt"],
      },
      {
        key: "runs",
        label: "Recent runs",
        resource: "runs",
        filter: (row) => ({ scraperId: row.id }),
      },
      {
        key: "listings",
        label: "Listings",
        resource: "listings",
        filter: (row) => ({ scraperId: row.id }),
      },
    ],
  },
});
