import type { ActionInput, RowAction } from "./action";
import type { ResourceName } from "./registry";
import type { FieldDef } from "./resource";
import type { CustomWidget, WidgetConfig } from "./widget";
import type { ChecklistWidget, HeatmapWidget } from "./widget-activity";
import type { TimelineWidget } from "./widget-timeline";
import type { TrackerWidget } from "./widget-tracker";

export type DrawerWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

/** Fields of a drawer view: row keys, explicit field defs, or `"*"` for all. */
export type DrawerFieldList<Row> = (keyof Row | FieldDef<Row>)[] | "*";

/** Drawer tab showing the row's own fields as a key/value list. */
export interface DrawerTabFields<Row = Record<string, unknown>> {
  /** Stable identifier for the tab. */
  key: string;
  label: string;
  /** Fields to show. `"*"` shows every declared column. */
  fields: DrawerFieldList<Row>;
}

/** Drawer tab listing rows of a related resource. */
export interface DrawerTabResource<Row = unknown> {
  key: string;
  label: string;
  /** Related resource to list. Must be registered on the same admin. */
  resource: ResourceName;
  /** Filter applied to the related resource, derived from the open row. */
  filter?: (row: Row) => Record<string, unknown>;
}

/** Drawer tab rendering dashboard widgets scoped to the open row. */
export interface DrawerTabWidgets {
  key: string;
  label: string;
  /** `custom()`, `tracker()` and page-rendered widgets (`timeline`, `heatmap`, `checklist`) are not renderable here — the drawer serializes over the wire. */
  widgets: Exclude<
    WidgetConfig,
    CustomWidget | TimelineWidget | HeatmapWidget | ChecklistWidget | TrackerWidget
  >[];
}

// Row defaults to an index signature, not `unknown`, whose `keyof` would collapse `fields` on a bare `DrawerTab`.
export type DrawerTab<Row = Record<string, unknown>> =
  | DrawerTabFields<Row>
  | DrawerTabResource<Row>
  | DrawerTabWidgets;

/**
 * An action in the open row's header menu, in the drawer and on the record page. It takes the same
 * options as a `RowAction`, apart from `hidden` and `disabled`: use `when` to offer it on some rows only.
 */
export interface DrawerAction<
  Row = Record<string, unknown>,
  Input extends ActionInput = ActionInput,
  Output = never,
> extends Omit<RowAction<Row, Input, Output>, "hidden" | "disabled"> {}

/** Side panel opened for a single row. */
export interface DrawerConfig<Row = Record<string, unknown>> {
  /** Panel width.
   * @defaultValue "lg"
   */
  width?: DrawerWidth;
  /** Panel title. Defaults to the row's key. */
  title?: (row: Row) => string;
  /** The line under the title. Defaults to the resource's label. */
  subtitle?: (row: Row) => string;
  /** Fields shown when no `tabs` are declared. `"*"` shows every column. */
  fields?: DrawerFieldList<Row>;
  /** Tabs to render instead of a flat field list. */
  tabs?: DrawerTab<Row>[];
  /** The row's own actions, in the header menu of the drawer and the record page. */
  actions?: DrawerAction<Row>[];
}
