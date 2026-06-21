import { resource } from "@flowpanel/kit";
import { eq } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { badge, formatDate } from "../format";

export const users = resource(schema.users, {
  label: "Customers",
  columns: [
    "email",
    "name",
    { field: "company", label: "Company", render: (u) => u.company ?? "—" },
    { field: "plan", label: "Plan", format: badge },
    { field: "status", label: "Status", format: badge },
    { field: "createdAt", label: "Joined", render: (u) => formatDate(u.createdAt) },
  ],
  search: ["email", "name", "company"],
  filters: [
    {
      field: "plan",
      type: "select",
      label: "Plan",
      options: [
        { label: "Free", value: "free" },
        { label: "Starter", value: "starter" },
        { label: "Pro", value: "pro" },
        { label: "Business", value: "business" },
      ],
    },
    {
      field: "status",
      type: "select",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Trialing", value: "trialing" },
        { label: "Past due", value: "past_due" },
        { label: "Canceled", value: "canceled" },
      ],
    },
    { field: "createdAt", type: "daterange", label: "Joined" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  delete: { softDelete: "deletedAt" },
  rowClick: "drawer",
  realtime: true,
  export: {
    formats: ["csv", "json"],
    fields: ["id", "email", "name", "company", "plan", "status", "createdAt"],
  },
  import: {
    formats: ["csv", "json"],
    fields: ["email", "name", "company", "plan", "status"],
  },
  drawer: {
    width: "lg",
    header: (row) => row.email,
    tabs: [
      { key: "profile", label: "Profile", fields: "*" },
      {
        key: "scrapers",
        label: "Scrapers",
        resource: "scrapers",
        filter: (row) => ({ userId: row.id }),
      },
      {
        key: "invoices",
        label: "Invoices",
        resource: "invoices",
        filter: (row) => ({ userId: row.id }),
      },
    ],
    actions: [
      {
        key: "disable",
        label: "Disable user",
        variant: "destructive",
        confirm: "Disable this user? They'll lose access immediately.",
        run: async (row, _input, ctx) => {
          await ctx.db
            .update(schema.users)
            .set({ deletedAt: new Date() })
            .where(eq(schema.users.id, row.id));
          return { ok: true, message: `Disabled ${row.email}`, refresh: true };
        },
      },
    ],
  },
});
