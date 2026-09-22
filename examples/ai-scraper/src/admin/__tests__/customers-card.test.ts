import type { InferRow } from "@flowpanel/kit";
import { describe, expect, it } from "vitest";
import type * as schema from "@/src/db/schema";
import { customers } from "../config/resources/customers";

type Customer = InferRow<typeof schema.customers>;

const detail = customers.options.detail;
if (!detail) throw new Error("customers must configure a detail page");

const row = {
  id: 7,
  email: "ops@northwind.test",
  name: "Jane Doe",
  company: "Northwind Audio",
  plan: "pro",
  status: "past_due",
  createdAt: new Date("2026-01-05T00:00:00.000Z"),
  lastSeenAt: null,
  deletedAt: null,
  sandboxId: "local",
  seedKey: null,
} as unknown as Customer;

describe("the customer entity card", () => {
  it("heads the page with the company, falling back to the email", () => {
    expect(detail.title?.(row)).toBe("Northwind Audio");
    expect(detail.title?.({ ...row, company: null })).toBe("ops@northwind.test");
  });

  it("identifies the account with its plan and status", () => {
    expect(detail.subtitle?.(row)).toBe("Pro · Past due");
  });

  it("tones the status pill by what the status means", () => {
    expect(detail.badge?.(row)).toEqual({ label: "Past due", tone: "err" });
    expect(detail.badge?.({ ...row, status: "active" })).toEqual({ label: "Active", tone: "ok" });
  });

  it("opens on a widgets tab of facts and counts", () => {
    const summary = detail.tabs?.[0];
    expect(summary?.key).toBe("summary");
    expect(summary?.widgets?.map((widget) => widget.kind)).toEqual([
      "kv",
      "stat",
      "stat",
      "stat",
      "stat",
    ]);
  });

  it("drops the parent key from every related tab and sorts it newest first", () => {
    const related = (detail.tabs ?? []).filter((tab) => tab.resource);
    expect(related.length).toBeGreaterThan(0);
    for (const tab of related) {
      expect(tab.hide).toEqual(["customerId"]);
      expect(tab.sort?.dir).toBe("desc");
    }
  });

  it("links every count on the summary tab to the rows it counted", async () => {
    const summary = detail.tabs?.[0];
    const stats = (summary?.widgets ?? []).filter((widget) => widget.kind === "stat");
    const ctx = {
      row,
      count: async () => 3,
      href: (resource: string, _id: undefined, opts?: { filter?: Record<string, unknown> }) =>
        `/admin/${resource}?f_customerId=${opts?.filter?.customerId}`,
      sql: async () => [{ cents: 4200 }],
    } as unknown as Parameters<
      Extract<(typeof stats)[number], { kind: "stat" }>["value"] & ((...a: never[]) => unknown)
    >[0];

    for (const widget of stats) {
      if (widget.kind !== "stat" || typeof widget.value !== "function") {
        throw new Error("every summary stat is computed per request");
      }
      const result = await widget.value(ctx);
      expect(result).toMatchObject({ href: expect.stringContaining("f_customerId=7") });
    }
  });

  it("keeps the drawer as what a row click opens", () => {
    expect(customers.options.rowClick).toBe("drawer");
  });
});
