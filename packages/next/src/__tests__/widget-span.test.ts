import type { WidgetConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { widgetSlotClassName, widgetSpanClassName } from "../pages/widget-slot";

describe("widgetSpanClassName", () => {
  it("uses a flex grid item only for a metric child", () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "x",
      query: async () => 1,
      options: {},
    };
    expect(widgetSlotClassName(widget)).toBe("flex");
  });
  it("preserves the normal block layout for non-metric widgets", () => {
    const widget: WidgetConfig = { kind: "table", options: {} };
    expect(widgetSlotClassName(widget)).toBeUndefined();
  });
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
    expect(widgetSlotClassName(widget)).toBe("col-span-12");
  });

  it("reads span regardless of widget kind (statGroup)", () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: { stats: [], span: 8 },
    } as never;
    expect(widgetSpanClassName(widget)).toBe("col-span-12 sm:col-span-8");
  });

  it("keeps chart and unframed custom widget children out of a flex row", () => {
    const chart: WidgetConfig = {
      kind: "areaChart",
      label: "x",
      query: async () => [],
      options: { x: "x", y: "y" },
    } as never;
    const custom: WidgetConfig = {
      kind: "custom",
      Component: () => null,
      props: {},
      options: { frame: false },
    };
    expect(widgetSlotClassName(chart)).toBeUndefined();
    expect(widgetSlotClassName(custom)).toBeUndefined();
  });
});
