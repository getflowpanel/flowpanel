import type { Span, WidgetConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { sectionColumns, widgetSlotClassName, widgetSpanClassName } from "../pages/widget-slot";

describe("widgetSpanClassName", () => {
  it("uses a flex grid item only for a metric child", () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "x",
      query: async () => 1,
      options: {},
    };
    expect(widgetSlotClassName(widget)).toBe("fp-flex");
  });
  it("keeps a table or a list at its own height, so a short one leaves no empty card", () => {
    expect(widgetSlotClassName({ kind: "table", options: {} })).toBe("fp-self-start");
    const list = { kind: "list", label: "x", query: async () => [], options: {} } as never;
    expect(widgetSlotClassName(list)).toBe("fp-self-start");
  });

  it("follows a section's align over the default", () => {
    const table: WidgetConfig = { kind: "table", options: {} };
    const metric = { kind: "metric", label: "x", query: async () => 1, options: {} } as never;
    expect(widgetSlotClassName(table, "stretch")).toBeUndefined();
    expect(widgetSlotClassName(metric, "start")).toBe("fp-flex fp-self-start");
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
    expect(widgetSpanClassName(widget)).toBe("fp-col-span-12 sm:fp-col-span-4");
  });

  it("reads span regardless of widget kind (table)", () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: { span: 12 },
    } as never;
    expect(widgetSpanClassName(widget)).toBe("fp-col-span-12");
    expect(widgetSlotClassName(widget)).toBe("fp-col-span-12 fp-self-start");
  });

  it("reads span regardless of widget kind (statGroup)", () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: { stats: [], span: 8 },
    } as never;
    expect(widgetSpanClassName(widget)).toBe("fp-col-span-12 sm:fp-col-span-8");
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

  it("maps every span from 1 to 11 to its column count from sm, and 12 to the full row", () => {
    for (let span = 1; span <= 11; span++) {
      const widget = { kind: "table", options: { span: span as Span } } as WidgetConfig;
      expect(widgetSpanClassName(widget)).toBe(`fp-col-span-12 sm:fp-col-span-${span}`);
    }
    const full = { kind: "table", options: { span: 12 } } as WidgetConfig;
    expect(widgetSpanClassName(full)).toBe("fp-col-span-12");
  });
});

describe("sectionColumns", () => {
  const spanned = { kind: "table", options: { span: 6 } } as WidgetConfig;
  const plain = { kind: "table", options: {} } as WidgetConfig;

  it("keeps declared columns", () => {
    expect(sectionColumns(3, [spanned], 1)).toBe(3);
  });

  it("uses 12 when a widget sets span and no columns are declared", () => {
    expect(sectionColumns(undefined, [plain, spanned], 1)).toBe(12);
    expect(sectionColumns(undefined, [spanned], 2)).toBe(12);
  });

  it("falls back to the section's or the tab's default otherwise", () => {
    expect(sectionColumns(undefined, [plain], 1)).toBe(1);
    expect(sectionColumns(undefined, [plain], 2)).toBe(2);
  });
});
