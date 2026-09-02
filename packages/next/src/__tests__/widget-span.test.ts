import type { WidgetConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { widgetSpanClassName } from "../pages/dashboard";

describe("widgetSpanClassName", () => {
  it("returns undefined when the widget declares no span", () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "x",
      query: async () => 1,
      options: {},
    } as never;
    expect(widgetSpanClassName(widget)).toBeUndefined();
  });

  it("maps a metric widget's span to the matching col-span class", () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "x",
      query: async () => 1,
      options: { span: 4 },
    } as never;
    expect(widgetSpanClassName(widget)).toBe("col-span-12 sm:col-span-4");
  });

  it("reads span regardless of widget kind (table)", () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: { span: 12 },
    } as never;
    expect(widgetSpanClassName(widget)).toBe("col-span-12");
  });

  it("reads span regardless of widget kind (statGroup)", () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: { stats: [], span: 8 },
    } as never;
    expect(widgetSpanClassName(widget)).toBe("col-span-12 sm:col-span-8");
  });
});
