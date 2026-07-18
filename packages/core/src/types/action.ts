import type { ActionContext, RequestContext } from "./context.js";
import type { InferDB } from "./registry.js";
import type { FieldDef } from "./resource.js";

/**
 * What an action returns. On success the runtime may show a toast, refresh the
 * list, redirect, or hand the operator a file — driven entirely by these keys.
 */
export type ActionResult =
  | {
      ok: true;
      /** Toast shown to the operator. */
      message?: string;
      /** Revalidate after the action. `true` refreshes the current resource; a string publishes that one channel. */
      refresh?: boolean | string | string[];
      /** Send the operator to this path once the action succeeds. */
      redirect?: string;
      /** Hand the operator a generated file. */
      download?: { filename: string; data: string | Blob | Uint8Array; mime?: string };
    }
  | {
      ok: false;
      /** Message shown to the operator. Safe to display — never include internals. */
      error: string;
      /** Per-field messages, keyed by `FieldDef.name`, for actions with a `form`. */
      fieldErrors?: Record<string, string>;
    };

/** Action offered on a single row of the list. */
export interface RowAction<Row> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** Lucide icon name. */
  icon?: string;
  /** Button styling. `"destructive"` marks a dangerous action. */
  variant?: "default" | "destructive" | "success";
  /** `"inline"` renders a button in the row; `"menu"` puts it in the row menu. */
  placement?: "inline" | "menu";
  /** Ask for confirmation before running. */
  confirm?: string | { title: string; description?: string; confirmLabel?: string };
  /** Inputs collected before `run`, passed to it as `input`. */
  form?: FieldDef<Row>[];
  /** Hide the action for rows it does not apply to. Evaluated server-side per row. */
  hidden?: (row: Row, ctx: RequestContext) => boolean | Promise<boolean>;
  /** Disable with a reason. A string is shown to the operator. */
  disabled?: (row: Row) => boolean | string;
  /** Restrict the action to a role. Enforced before `run`. */
  requireRole?: string | string[];
  /** Server-side handler. Runs only after every guard has passed. */
  run: (row: Row, input: unknown, ctx: ActionContext<InferDB>) => Promise<ActionResult>;
}

/** Action applied to every selected row at once. */
export interface BulkAction<Row> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** Lucide icon name. */
  icon?: string;
  /** Button styling. `"destructive"` marks a dangerous action. */
  variant?: "default" | "destructive";
  /** Ask for confirmation before running. */
  confirm?: string | { title: string; description?: string };
  /** Inputs collected before `run`, passed to it as `input`. */
  form?: FieldDef<Row>[];
  /** Restrict the action to a role. Enforced before `run`. */
  requireRole?: string | string[];
  /** Server-side handler, given every selected id. Capped at 1000 ids per call. */
  run: (ids: string[], input: unknown, ctx: ActionContext<InferDB>) => Promise<ActionResult>;
}

/** Action declared on a dashboard, rendered in the dashboard page header. */
export interface DashboardAction {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** Lucide icon name. */
  icon?: string;
  /** Button styling. `"destructive"` marks a dangerous action. */
  variant?: "default" | "destructive" | "success";
  /** Ask for confirmation before running. */
  confirm?: string | { title: string; description?: string; confirmLabel?: string };
  /** Inputs collected before `run`, passed to it as `input`. */
  form?: FieldDef<Record<string, unknown>>[];
  /** Restrict the action to a role. Enforced before `run`. */
  requireRole?: string | string[];
  /** Server-side handler. Runs only after every guard has passed. */
  run: (input: unknown, ctx: ActionContext<InferDB>) => Promise<ActionResult>;
}
