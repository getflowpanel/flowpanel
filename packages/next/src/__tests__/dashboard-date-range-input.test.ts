import { describe, expect, it } from "vitest";
import { resolveDashboardDateRangeInput } from "../pages/dashboard";

function sp(entries: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(entries);
}

describe("resolveDashboardDateRangeInput", () => {
  it("falls back to resolveDateRange's own default when nothing is declared or requested", () => {
    expect(resolveDashboardDateRangeInput(undefined, sp())).toEqual({});
  });

  it("honors the dashboard's own dateRange.preset when nothing overrides it", () => {
    expect(resolveDashboardDateRangeInput({ preset: "last30d" }, sp())).toEqual({
      preset: "last30d",
    });
  });

  it("a URL ?preset= overrides the dashboard's declared preset", () => {
    const input = resolveDashboardDateRangeInput({ preset: "last30d" }, sp({ preset: "today" }));
    expect(input).toEqual({ preset: "today" });
  });

  it("an invalid URL ?preset= is ignored, falling back to the dashboard's preset", () => {
    const input = resolveDashboardDateRangeInput(
      { preset: "MTD" },
      sp({ preset: "not-a-real-preset" }),
    );
    expect(input).toEqual({ preset: "MTD" });
  });

  it("URL ?from=/?to= pass through alongside any preset — resolveDateRange itself decides precedence", () => {
    const input = resolveDashboardDateRangeInput(
      { preset: "last7d" },
      sp({ from: "2026-01-01", to: "2026-02-01" }),
    );
    expect(input).toEqual({ preset: "last7d", from: "2026-01-01", to: "2026-02-01" });
  });

  it("dateRange.default applies only when neither a preset nor from/to is present", () => {
    const defaultRange = { from: new Date("2026-01-01"), to: new Date("2026-01-08") };
    const input = resolveDashboardDateRangeInput({ default: defaultRange }, sp());
    expect(input).toEqual({ from: defaultRange.from, to: defaultRange.to });
  });

  it("a dashboard-declared preset takes priority over dateRange.default", () => {
    const defaultRange = { from: new Date("2026-01-01"), to: new Date("2026-01-08") };
    const input = resolveDashboardDateRangeInput({ preset: "YTD", default: defaultRange }, sp());
    expect(input).toEqual({ preset: "YTD" });
  });

  it("a URL preset takes priority over dateRange.default", () => {
    const defaultRange = { from: new Date("2026-01-01"), to: new Date("2026-01-08") };
    const input = resolveDashboardDateRangeInput({ default: defaultRange }, sp({ preset: "QTD" }));
    expect(input).toEqual({ preset: "QTD" });
  });

  it("URL from/to takes priority over dateRange.default", () => {
    const defaultRange = { from: new Date("2026-01-01"), to: new Date("2026-01-08") };
    const input = resolveDashboardDateRangeInput(
      { default: defaultRange },
      sp({ from: "2026-03-01", to: "2026-03-08" }),
    );
    expect(input).toEqual({ from: "2026-03-01", to: "2026-03-08" });
  });
});
