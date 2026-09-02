import type { z } from "zod";
import type { ActionResult } from "./action";
import type { ActionContext } from "./context";
import type { AccessRule, FieldWriteContext } from "./policy";
import type { InferDB, ResourceName } from "./registry";
import type { FieldDef } from "./resource";
import type { CustomWidget, WidgetConfig } from "./widget";

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
  /** `custom()` widgets are not renderable here — the drawer serializes over the wire. */
  widgets: Exclude<WidgetConfig, CustomWidget>[];
}

// Row defaults to an index signature, not `unknown`: `keyof unknown` is `never`,
// which would collapse `fields` on a bare `DrawerTab` (see DashboardAction.form).
export type DrawerTab<Row = Record<string, unknown>> =
  | DrawerTabFields<Row>
  | DrawerTabResource<Row>
  | DrawerTabWidgets;

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
export interface DrawerAction<Row = Record<string, unknown>> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** `"destructive"` styles the button as dangerous. */
  variant?: "default" | "destructive";
  /** Ask for confirmation with this message before running. */
  confirm?: string;
  /** Inputs collected before `run`, passed to it as `formData`. */
  form?: DrawerFieldFormSpec[];
  /** Also offer the action in the command palette. */
  palette?: boolean;
  /** Roles allowed to see and execute this action. */
  access?: AccessRule;
  /** Server-enforced row condition evaluated after the scoped row load. */
  when?: (context: FieldWriteContext<Row>) => boolean | Promise<boolean>;
  /** Explicitly opt trusted code into raw database access. */
  unsafe?: readonly "db"[];
  /** @deprecated Use `access`. This alias will be removed in 0.3. */
  requireRole?: string | string[];
  /** Server-side handler. Runs only after every guard has passed. */
  run: (
    row: Row,
    formData: Record<string, unknown>,
    ctx: ActionContext<InferDB>,
  ) => Promise<ActionResult>;
}

/** Side panel opened for a single row. */
export interface DrawerConfig<Row = Record<string, unknown>> {
  /** Panel width.
   * @defaultValue "lg"
   */
  width?: DrawerWidth;
  /** Panel title. Defaults to the row's key. */
  header?: (row: Row) => string;
  /** Fields shown when no `tabs` are declared. `"*"` shows every column. */
  fields?: DrawerFieldList<Row>;
  /** Tabs to render instead of a flat field list. */
  tabs?: DrawerTab<Row>[];
  /** Buttons rendered in the panel footer. */
  actions?: DrawerAction<Row>[];
}
