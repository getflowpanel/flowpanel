import { describe, expect, it, vi } from "vitest";
import { metric, type WidgetContext } from "../index";

function contextWith(count: WidgetContext["count"]): WidgetContext {
  return { id: "u1", count } as unknown as WidgetContext;
}

const visits = {
  count: "user_visit",
  where: (c: WidgetContext) => ({ userId: c.id }),
  range: "startedAt",
};

describe("metric({ count })", () => {
  it("counts the resource with its where and range", async () => {
    const count = vi.fn().mockResolvedValue(7);
    const widget = metric("Visits", visits);
    expect(await widget.query(contextWith(count))).toBe(7);
    expect(count).toHaveBeenCalledWith("user_visit", { userId: "u1" }, { range: "startedAt" });
    expect(widget.options.format).toBe("number");
  });

  it("links the card to the rows it counted, with the same scope and period", () => {
    const widget = metric("Visits", visits);
    const drilldown = widget.options.drilldown as (c: WidgetContext) => unknown;
    expect(drilldown(contextWith(vi.fn()))).toEqual({
      resource: "user_visit",
      filter: { userId: "u1" },
      range: "startedAt",
    });
    expect(widget.source).toEqual({
      resource: "user_visit",
      where: visits.where,
      range: "startedAt",
      linked: true,
    });
  });

  it("links nowhere when the where has no value to scope by, instead of the whole list", () => {
    const widget = metric("Visits", visits);
    const drilldown = widget.options.drilldown as (c: WidgetContext) => unknown;
    expect(drilldown({ count: vi.fn() } as unknown as WidgetContext)).toBeNull();
  });

  it("links the overlap when where and range bound the same field, as the count does", () => {
    const since = new Date("2026-09-17T00:00:00Z");
    const week = { from: new Date("2026-09-14T00:00:00Z"), to: new Date("2026-09-21T00:00:00Z") };
    const widget = metric("Recent", {
      count: "order",
      where: { createdAt: { gte: since } },
      range: "createdAt",
    });
    const drilldown = widget.options.drilldown as (c: WidgetContext) => unknown;
    expect(drilldown({ dateRange: week } as unknown as WidgetContext)).toEqual({
      resource: "order",
      filter: { createdAt: { op: "range", gte: since, lte: week.to } },
    });
  });

  it("counts every row with no where and no range, and links the whole list", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const widget = metric("Users", { count: "user" });
    expect(await widget.query(contextWith(count))).toBe(3);
    expect(count).toHaveBeenCalledWith("user", {}, {});
    const drilldown = widget.options.drilldown as (c: WidgetContext) => unknown;
    expect(drilldown(contextWith(vi.fn()))).toEqual({ resource: "user", filter: {} });
  });

  it("keeps a drilldown of its own and says the card no longer links its rows", () => {
    const widget = metric(
      "Paid",
      { count: "order", where: { status: "paid" } },
      { drilldown: "/billing" },
    );
    expect(widget.options.drilldown).toBe("/billing");
    expect(widget.source).toEqual({ resource: "order", where: { status: "paid" }, linked: false });
  });

  it("leaves the query form unchanged", async () => {
    const widget = metric("Answer", async () => 42, { compare: true });
    expect(await widget.query(contextWith(vi.fn()))).toBe(42);
    expect(widget.source).toBeUndefined();
    expect(widget.options).toEqual({ format: "number", compare: true });
  });
});
