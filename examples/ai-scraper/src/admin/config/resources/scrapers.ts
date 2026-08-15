import { type BulkAction, type FieldDef, resource } from "@flowpanel/kit";
import { inArray } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { badge, formatShortDate, urlCell } from "../format";

type Scraper = typeof schema.scrapers.$inferSelect;

const STATUSES = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Error", value: "error" },
];

const SCHEDULES = [
  { label: "Manual", value: "manual" },
  { label: "Hourly", value: "hourly" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
];

// Explicit specs: enum columns render as selects, and `userId` as a searchable
// picker over the users table rather than a raw integer input.
const fields: FieldDef<Scraper>[] = [
  {
    name: "name",
    label: "Name",
    required: true,
    placeholder: "Amazon BSR — Electronics",
    span: 6,
    group: "Target",
  },
  {
    name: "targetUrl",
    label: "Target URL",
    type: "url",
    required: true,
    placeholder: "https://www.amazon.com/Best-Sellers/zgbs",
    validate: (v) => (/^https?:\/\/\S+$/.test(String(v)) ? null : "Must be an http(s) URL"),
    span: 6,
    group: "Target",
  },
  {
    name: "userId",
    label: "Customer",
    type: "reference",
    reference: { resource: "users", labelField: "email" },
    required: true,
    group: "Target",
  },
  {
    name: "schedule",
    label: "Schedule",
    type: "select",
    options: SCHEDULES,
    defaultValue: "daily",
    span: 6,
    group: "Run policy",
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: STATUSES,
    defaultValue: "active",
    help: "Paused scrapers keep their schedule but never run.",
    span: 6,
    group: "Run policy",
  },
];

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
  labelOne: "Scraper",
  columns: [
    "name",
    {
      field: "userId",
      label: "Customer",
      reference: { resource: "users", labelField: "email" },
    },
    { field: "targetUrl", label: "Target URL", render: (s) => urlCell(s.targetUrl) },
    "schedule",
    { field: "status", label: "Status", format: badge },
    { field: "lastRunAt", label: "Last run", render: (s) => formatShortDate(s.lastRunAt) },
  ],
  search: ["name", "targetUrl"],
  filters: [
    { field: "status", type: "select", label: "Status", options: STATUSES },
    { field: "schedule", type: "select", label: "Schedule", options: SCHEDULES },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { fields },
  update: { fields },
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
