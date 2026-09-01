import { bulkAction, type FieldDef, resource } from "@flowpanel/kit";
import { badge, urlCell } from "@/src/admin/format";
import { pauseMonitors, resumeMonitors } from "@/src/admin/mutations";
import * as schema from "@/src/db/schema";
import { sandboxField, sandboxResourcePolicy } from "@/src/demo/sandbox/scope";

type Monitor = typeof schema.monitors.$inferSelect;

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

const fields: FieldDef<Monitor>[] = [
  {
    name: "name",
    required: true,
    placeholder: "Amazon · Audio",
    span: 6,
    group: "Target",
  },
  {
    name: "targetUrl",
    type: "url",
    required: true,
    placeholder: "https://amazon.com/search?q=audio",
    validate: (value) => (/^https?:\/\/\S+$/.test(String(value)) ? null : "Enter an http(s) URL"),
    span: 6,
    group: "Target",
  },
  {
    name: "customerId",
    type: "reference",
    reference: { resource: "customers", labelField: "company" },
    required: true,
    group: "Target",
  },
  {
    name: "schedule",
    type: "select",
    options: SCHEDULES,
    defaultValue: "daily",
    span: 6,
    group: "Run policy",
  },
  {
    name: "status",
    type: "select",
    options: STATUSES,
    defaultValue: "active",
    help: "Paused monitors keep their schedule but do not run.",
    span: 6,
    group: "Run policy",
  },
];

export const monitors = resource(schema.monitors, {
  ...sandboxResourcePolicy(schema.monitors.sandboxId),
  name: "monitors",
  label: "Monitors",
  labelOne: "Monitor",
  icon: "workflow",
  columns: [
    "name",
    {
      field: "customerId",
      label: "Customer",
      reference: { resource: "customers", labelField: "company" },
    },
    { field: "targetUrl", label: "Target", render: (row) => urlCell(row.targetUrl) },
    "schedule",
    { field: "status", format: badge },
    { field: "lastRunAt", label: "Last run" },
  ],
  search: ["name", "targetUrl"],
  filters: [
    { field: "status", type: "select", options: STATUSES },
    { field: "schedule", type: "select", options: SCHEDULES },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { fields: [...fields, sandboxField<Monitor>()] },
  update: { fields },
  delete: {
    confirm:
      "Permanently delete selected monitors and their runs, offers, matches, and AI usage? This cannot be undone.",
  },
  bulkActions: [
    bulkAction<Monitor>({
      key: "pause",
      label: "Pause selected",
      icon: "ban",
      confirm: {
        title: "Pause selected monitors?",
        description: "They stop running on schedule until resumed.",
      },
      run: pauseMonitors,
    }),
    bulkAction<Monitor>({
      key: "resume",
      label: "Resume selected",
      icon: "play",
      confirm: {
        title: "Resume selected monitors?",
        description: "They return to their schedule.",
      },
      run: resumeMonitors,
    }),
  ],
  rowClick: "drawer",
  drawer: {
    width: "lg",
    header: (row) => row.name,
    tabs: [
      {
        key: "detail",
        label: "Details",
        fields: ["name", "targetUrl", "schedule", "status", "lastRunAt", "createdAt"],
      },
      {
        key: "runs",
        label: "Recent runs",
        resource: "runs",
        filter: (row) => ({ monitorId: row.id }),
      },
      {
        key: "offers",
        label: "Offers",
        resource: "listings",
        filter: (row) => ({ monitorId: row.id }),
      },
    ],
  },
});
