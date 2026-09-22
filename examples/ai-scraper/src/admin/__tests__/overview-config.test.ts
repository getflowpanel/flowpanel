import { describe, expect, it } from "vitest";
import { overview } from "../config/dashboards/overview";

const widgets = overview.sections.flatMap((section) => section.widgets);
const kinds = widgets.map((widget) => widget.kind);

describe("the founder overview", () => {
  it("re-reads its numbers on an interval", () => {
    expect(overview.refresh).toBe("60s");
  });

  it("is built from the widget primitives rather than custom cards", () => {
    for (const kind of ["metric", "table", "bars", "funnel", "list", "stat"]) {
      expect(kinds).toContain(kind);
    }
  });

  it("keeps the four headline metrics first, in the story's order", () => {
    const headline = overview.sections[0]?.widgets ?? [];
    expect(headline.map((widget) => (widget.kind === "metric" ? widget.label : null))).toEqual([
      "Active monitors",
      "Offers discovered",
      "Crawl success",
      "Needs review",
    ]);
  });

  it("links the recent-runs table to a row's page and to the full list", () => {
    const table = widgets.find((widget) => widget.kind === "table");
    if (table?.kind !== "table") throw new Error("the overview must carry a table widget");
    expect(table.options.seeAll).toBe(true);
    expect(table.options.rowHref).toBeTypeOf("function");
    expect(table.options.resource).toBe("runs");
  });

  it("keeps the realtime operations surface as the one custom widget", () => {
    expect(kinds.filter((kind) => kind === "custom")).toHaveLength(2);
  });
});
