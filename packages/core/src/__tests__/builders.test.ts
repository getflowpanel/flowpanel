import { describe, expect, it } from "vitest";
import { custom, dashboard, metric, page, statGroup, table } from "../index.js";

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
