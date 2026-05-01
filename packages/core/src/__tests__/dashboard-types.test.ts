import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";
import type {
  CommandGroup,
  CommandPaletteConfig,
  CustomWidget,
  DashboardConfig,
  DrawerConfig,
  DrawerTab,
  MetricWidget,
  ResolvedDateRange,
  SectionConfig,
  StatGroupWidget,
  TableWidget,
  WidgetConfig,
} from "../index.js";

describe("M2 public types", () => {
  it("DashboardConfig shape matches spec", () => {
    expectTypeOf<DashboardConfig>().toMatchTypeOf<{
      path: string;
      label: string;
      icon?: string;
      realtime?: string | string[];
      sections: SectionConfig[];
    }>();
  });

  it("MetricWidget carries label, query, options", () => {
    expectTypeOf<MetricWidget>().toHaveProperty("kind").toEqualTypeOf<"metric">();
    expectTypeOf<MetricWidget>().toHaveProperty("label").toEqualTypeOf<string>();
  });

  it("TableWidget has kind='table' and options", () => {
    expectTypeOf<TableWidget>().toHaveProperty("kind").toEqualTypeOf<"table">();
    expectTypeOf<TableWidget>().toHaveProperty("options");
  });

  it("CustomWidget and StatGroupWidget exist with correct kinds", () => {
    expectTypeOf<CustomWidget>().toHaveProperty("kind").toEqualTypeOf<"custom">();
    expectTypeOf<StatGroupWidget>().toHaveProperty("kind").toEqualTypeOf<"statGroup">();
  });

  it("WidgetConfig is a discriminated union", () => {
    expectTypeOf<WidgetConfig["kind"]>().toEqualTypeOf<
      | "metric"
      | "table"
      | "custom"
      | "statGroup"
      | "areaChart"
      | "barChart"
      | "lineChart"
      | "pieChart"
    >();
  });

  it("ResolvedDateRange carries preset + from/to", () => {
    expectTypeOf<ResolvedDateRange>().toMatchTypeOf<{
      from: Date;
      to: Date;
    }>();
  });

  it("CommandPaletteConfig has optional groups", () => {
    expectTypeOf<CommandPaletteConfig>().toHaveProperty("groups");
    expectTypeOf<CommandGroup>().toHaveProperty("label").toEqualTypeOf<string>();
  });

  it("DrawerConfig supports tabs with widgets OR resource OR fields", () => {
    expectTypeOf<DrawerTab>().toMatchTypeOf<
      | { key: string; label: string; fields: "*" | string[] }
      | {
          key: string;
          label: string;
          resource: string;
          filter?: (row: unknown) => Record<string, unknown>;
        }
      | { key: string; label: string; widgets: WidgetConfig[] }
    >();
    expectTypeOf<DrawerConfig>().toHaveProperty("width");
    expectTypeOf<DrawerConfig>().toHaveProperty("tabs");
  });
});
