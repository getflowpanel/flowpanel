import { describe, expect, it } from "vitest";
import { renderWidgetTemplate, WIDGETS } from "../templates";

describe("widget templates", () => {
  it("exposes the full widget catalogue", () => {
    const names = Object.keys(WIDGETS);
    expect(names).toContain("stat-card");
    expect(names).toContain("timeline");
    expect(names).toContain("kv");
    expect(names).toContain("status-banner");
    expect(names).toContain("sparkline");
  });

  it("status-banner and sparkline compile to inspectable sources", () => {
    expect(WIDGETS["status-banner"]!.source).toContain("export function StatusBanner");
    expect(WIDGETS["status-banner"]!.source).toContain('role="status"');
    expect(WIDGETS.sparkline!.source).toContain("export function Sparkline");
    expect(WIDGETS.sparkline!.source).toContain("<polyline");
  });

  it("each template has filename + exportName + non-empty source", () => {
    for (const [name, t] of Object.entries(WIDGETS)) {
      expect(t.filename, name).toMatch(/\.tsx$/);
      expect(t.exportName, name).toMatch(/^[A-Z]/);
      expect(t.source.length).toBeGreaterThan(0);
    }
  });

  it("renderWidgetTemplate returns the source unchanged for tokens-free templates", () => {
    const rendered = renderWidgetTemplate("stat-card", WIDGETS["stat-card"] as never);
    expect(rendered).toContain("export function StatCard");
  });
});
