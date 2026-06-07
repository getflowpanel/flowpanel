import type { z } from "zod";
import type { ActionContext } from "./context.js";
import type { InferDB, ResourceName } from "./registry.js";
import type { WidgetConfig } from "./widget.js";

export type DrawerWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

/** Drawer tab showing the row's own fields as a key/value list. */
export interface DrawerTabFields {
  /** Stable identifier for the tab. */
  key: string;
  label: string;
  /** Fields to show. `"*"` shows every declared column. */
  fields: "*" | string[];
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
  widgets: WidgetConfig[];
}

export type DrawerTab<Row = unknown> = DrawerTabFields | DrawerTabResource<Row> | DrawerTabWidgets;

/** Input field of a `DrawerAction.form`. */
export interface DrawerFieldFormSpec {
  /** Key this input contributes to the action's `formData`. */
  name: string;
  /** Control to render. Defaults to `"text"`. */
  type?: "text" | "textarea" | "select" | "switch" | "number";
  /** Choices for `select`. */
  options?: string[];
  /** Reject an empty value. Enforced server-side. */
  required?: boolean;
  /** Per-input validation, run server-side before `run`. */
  validate?:
    | z.ZodTypeAny
    | ((value: unknown, values: Record<string, unknown>) => string | null | Promise<string | null>);
}

/** Button rendered in the drawer footer for the open row. */
export interface DrawerAction<Row = unknown> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** `"destructive"` styles the button as dangerous. */
  variant?: "default" | "destructive";
  /** Lucide icon name. */
  icon?: string;
  /** Ask for confirmation with this message before running. */
  confirm?: string;
  /** Inputs collected before `run`, passed to it as `formData`. */
  form?: DrawerFieldFormSpec[];
  /** Also offer the action in the command palette. */
  palette?: boolean;
  /** Server-side handler. Runs only after every guard has passed. */
  run: (
    row: Row,
    formData: Record<string, unknown>,
    ctx: ActionContext<InferDB>,
  ) => Promise<{ ok: boolean; message?: string; refresh?: boolean | string | string[] }>;
}

/** Side panel opened for a single row. */
export interface DrawerConfig<Row = unknown> {
  /** Panel width. Defaults to `"lg"`. */
  width?: DrawerWidth;
  /** Panel title. Defaults to the row's key. */
  header?: (row: Row) => string;
  /** Fields shown when no `tabs` are declared. `"*"` shows every column. */
  fields?: "*" | string[];
  /** Tabs to render instead of a flat field list. */
  tabs?: DrawerTab<Row>[];
  /** Buttons rendered in the panel footer. */
  actions?: DrawerAction<Row>[];
}
