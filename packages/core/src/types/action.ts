import type { z } from "zod";
import type { ActionContext, RequestContext } from "./context";
import type { IconName } from "./icon";
import type { AccessRule, FieldWriteContext } from "./policy";
import type { InferDB } from "./registry";
import type { FieldDef } from "./resource";

/** Object collected by an action form and handed to its server-side handler. */
export type ActionInput = Record<string, unknown>;

/**
 * What an action returns. On success the runtime may show a toast, refresh the
 * list, redirect, or hand the operator a file — driven entirely by these keys.
 */
export type ActionResult<Data = never> =
  | ({
      ok: true;
      /** Toast shown to the operator. */
      message?: string;
      /** Revalidate after the action. `true` refreshes the current resource; a string publishes that one channel. */
      refresh?: boolean | string | string[];
      /** Send the operator to this path once the action succeeds. */
      redirect?: string;
      /** Hand the operator a generated file. */
      download?: { filename: string; data: string | Blob | Uint8Array; mime?: string };
    } & ([Data] extends [never] ? { data?: never } : { data?: Data }))
  | {
      ok: false;
      /** Message shown to the operator. Safe to display — never include internals. */
      error: string;
      /** Per-field messages, keyed by `FieldDef.name`, for actions with a `form`. */
      fieldErrors?: Record<string, string>;
    };

/** Action offered on a single row of the list. */
/** Button styling shared by every action kind. `"destructive"` marks a dangerous action. */
export type ActionVariant = "default" | "destructive" | "success";

/** Confirmation prompt shown before an action runs. */
export type ActionConfirm = string | { title: string; description?: string; confirmLabel?: string };

export interface RowAction<Row, Input extends ActionInput = ActionInput, Output = never> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** Serializable Lucide icon rendered beside the label. */
  icon?: IconName;
  /** Button styling. */
  variant?: ActionVariant;
  /** `"inline"` renders a button in the row; `"menu"` puts it in the row menu. */
  placement?: "inline" | "menu";
  /** Ask for confirmation before running. */
  confirm?: ActionConfirm;
  /** Inputs collected before `run`, passed to it as `input`. */
  form?: FieldDef<Input>[];
  /** Cross-field input validation for trusted action code. */
  inputSchema?: z.ZodType<Input>;
  /** Required before arbitrary `data` may cross the client boundary. */
  outputSchema?: z.ZodType<Output>;
  /** Hide the action for rows it does not apply to. Evaluated server-side per row. */
  hidden?: (row: Row, ctx: RequestContext) => boolean | Promise<boolean>;
  /** Disable with a reason. A string is shown to the operator. */
  disabled?: (row: Row) => boolean | string;
  /** Restrict the action to a role. Enforced before `run`. */
  access?: AccessRule;
  /** Server-enforced row condition, evaluated only after a scoped row load. */
  when?: (context: FieldWriteContext<Row>) => boolean | Promise<boolean>;
  /** Explicitly opt trusted code into raw database access. */
  unsafe?: readonly "db"[];
  /** @deprecated Use `access`. This alias will be removed in 0.3. */
  requireRole?: string | string[];
  /** Server-side handler. Runs only after every guard has passed. */
  run: (row: Row, input: Input, ctx: ActionContext<InferDB>) => Promise<ActionResult<Output>>;
}

/** Action applied to every selected row at once. */
// biome-ignore lint/correctness/noUnusedVariables: Row binds the action to its owning resource even though the runtime handler receives selected ids.
export interface BulkAction<Row, Input extends ActionInput = ActionInput, Output = never> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** Serializable Lucide icon rendered beside the label. */
  icon?: IconName;
  /** Button styling. */
  variant?: ActionVariant;
  /** Ask for confirmation before running. */
  confirm?: ActionConfirm;
  /** Inputs collected before `run`, passed to it as `input`. */
  form?: FieldDef<Input>[];
  /** Cross-field input validation for trusted action code. */
  inputSchema?: z.ZodType<Input>;
  /** Required before arbitrary `data` may cross the client boundary. */
  outputSchema?: z.ZodType<Output>;
  /** Restrict the action to a role. Enforced before `run`. */
  access?: AccessRule;
  /** Maximum selected ids accepted by this action.
   * @defaultValue 1000
   */
  max?: number;
  /** Explicitly opt trusted code into raw database access. */
  unsafe?: readonly "db"[];
  /** @deprecated Use `access`. This alias will be removed in 0.3. */
  requireRole?: string | string[];
  /** Server-side handler, given every selected id. Capped at 1000 ids per call. */
  run: (ids: string[], input: Input, ctx: ActionContext<InferDB>) => Promise<ActionResult<Output>>;
}

/** Action declared on a dashboard, rendered in the dashboard page header. */
export interface DashboardAction<Input extends ActionInput = ActionInput, Output = never> {
  /** Stable identifier, used in the action's URL. */
  key: string;
  label: string;
  /** Serializable Lucide icon rendered beside the label. */
  icon?: IconName;
  /** Button styling. */
  variant?: ActionVariant;
  /** Ask for confirmation before running. */
  confirm?: ActionConfirm;
  /** Inputs collected before `run`, passed to it as `input`. */
  form?: FieldDef<Input>[];
  /** Cross-field input validation for trusted action code. */
  inputSchema?: z.ZodType<Input>;
  /** Required before arbitrary `data` may cross the client boundary. */
  outputSchema?: z.ZodType<Output>;
  /** Restrict the action to a role. Enforced before `run`. */
  access?: AccessRule;
  /** Explicitly opt trusted code into raw database access. */
  unsafe?: readonly "db"[];
  /** @deprecated Use `access`. This alias will be removed in 0.3. */
  requireRole?: string | string[];
  /** Server-side handler. Runs only after every guard has passed. */
  run: (input: Input, ctx: ActionContext<InferDB>) => Promise<ActionResult<Output>>;
}

/** Type-preserving helper for a row action with a dedicated form payload. */
export function rowAction<Row, Input extends ActionInput = ActionInput, Output = never>(
  definition: RowAction<Row, Input, Output>,
): RowAction<Row, Input, Output> {
  return definition;
}

/** Type-preserving helper for a bulk action with a dedicated form payload. */
export function bulkAction<Row, Input extends ActionInput = ActionInput, Output = never>(
  definition: BulkAction<Row, Input, Output>,
): BulkAction<Row, Input, Output> {
  return definition;
}

/** Type-preserving helper for a dashboard action with a dedicated form payload. */
export function dashboardAction<Input extends ActionInput = ActionInput, Output = never>(
  definition: DashboardAction<Input, Output>,
): DashboardAction<Input, Output> {
  return definition;
}
