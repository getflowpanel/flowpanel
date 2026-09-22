import { describe, expect, it } from "vitest";
import {
  bars,
  custom,
  dashboard,
  funnel,
  kv,
  list,
  metric,
  page,
  stat,
  statGroup,
  table,
} from "../index";

describe("M2 builders", () => {
  it("metric() produces MetricWidget with kind and defaults", () => {
    const w = metric("Users", async () => 42);
    expect(w.kind).toBe("metric");
    expect(w.label).toBe("Users");
    expect(w.options.format).toBe("number");
  });

  it("metric() allows overriding format via options", () => {
    const w = metric("Revenue", async () => 1000, { format: "currency" });
    expect(w.options.format).toBe("currency");
  });

  it("table({resource}) marks kind='table'", () => {
    const w = table({ resource: "users", limit: 10 });
    expect(w.kind).toBe("table");
    expect(w.options.resource).toBe("users");
    expect(w.options.limit).toBe(10);
  });

  it("custom() preserves Component and props function", () => {
    const C = () => null;
    const w = custom(C, async () => ({ x: 1 }));
    expect(w.kind).toBe("custom");
    expect(w.Component).toBe(C);
    expect(typeof w.props).toBe("function");
  });

  it("statGroup() wraps stats array", () => {
    const w = statGroup({ stats: [{ label: "A", value: 1 }] });
    expect(w.kind).toBe("statGroup");
    expect(w.options.stats).toHaveLength(1);
  });

  it("stat() keeps a literal value and its options", () => {
    const w = stat("Signups", 42, { hint: "last 7 days", tone: "ok" });
    expect(w.kind).toBe("stat");
    expect(w.label).toBe("Signups");
    expect(w.value).toBe(42);
    expect(w.options.hint).toBe("last 7 days");
  });

  it("stat() keeps a resolver value unresolved", () => {
    const w = stat("Signups", async () => 7);
    expect(typeof w.value).toBe("function");
    expect(w.options).toEqual({});
  });

  it("kv() wraps its items", () => {
    const w = kv({ label: "Plan", items: [{ label: "Seats", value: 12 }], columns: 2 });
    expect(w.kind).toBe("kv");
    expect(w.options.items).toHaveLength(1);
    expect(w.options.columns).toBe(2);
  });

  it("bars(), funnel() and list() tag their kind and keep the query", () => {
    const query = async () => [];
    expect(bars({ query }).kind).toBe("bars");
    expect(funnel({ query }).kind).toBe("funnel");
    expect(list({ query }).kind).toBe("list");
    expect(bars({ query }).options.query).toBe(query);
  });

  it("dashboard() returns config as-is", () => {
    const d = dashboard({ path: "/", label: "Overview", sections: [] });
    expect(d.path).toBe("/");
    expect(d.label).toBe("Overview");
    expect(d.sections).toEqual([]);
  });

  it("page() returns config", () => {
    const p = page({ path: "/custom", label: "Custom" });
    expect(p.path).toBe("/custom");
    expect(p.label).toBe("Custom");
  });
});
