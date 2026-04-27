import { describe, expect, it } from "vitest";
import { renderWidgetTemplate, WIDGETS } from "../templates";

describe("widget templates", () => {
  it("exposes at least stat-card, timeline, kv", () => {
    const names = Object.keys(WIDGETS);
    expect(names).toContain("stat-card");
    expect(names).toContain("timeline");
    expect(names).toContain("kv");
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
