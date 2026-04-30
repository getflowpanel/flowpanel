import type { ActionContext, RequestContext } from "./context.js";
import type { FieldDef } from "./resource.js";

export type ActionResult =
  | {
      ok: true;
      message?: string;
      refresh?: boolean | string[];
      redirect?: string;
      download?: { filename: string; data: string | Blob | Uint8Array; mime?: string };
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
    };

export interface RowAction<Row> {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive" | "success";
  placement?: "inline" | "menu";
  confirm?: string | { title: string; description?: string; confirmLabel?: string };
  form?: FieldDef<Row>[];
  hidden?: (row: Row, ctx: RequestContext) => boolean | Promise<boolean>;
  disabled?: (row: Row) => boolean | string;
  requireRole?: string | string[];
  run: (row: Row, input: unknown, ctx: ActionContext) => Promise<ActionResult>;
}

export interface BulkAction<Row> {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive";
  confirm?: string | { title: string; description?: string };
  form?: FieldDef<Row>[];
  requireRole?: string | string[];
  run: (ids: string[], input: unknown, ctx: ActionContext) => Promise<ActionResult>;
}
