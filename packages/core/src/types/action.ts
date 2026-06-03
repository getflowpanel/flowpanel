import type { ActionContext, RequestContext } from "./context.js";
import type { InferDB } from "./registry.js";
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

export interface RowAction<Row, DB = InferDB> {
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
  run: (row: Row, input: unknown, ctx: ActionContext<DB>) => Promise<ActionResult>;
}

export interface BulkAction<Row, DB = InferDB> {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive";
  confirm?: string | { title: string; description?: string };
  form?: FieldDef<Row>[];
  requireRole?: string | string[];
  run: (ids: string[], input: unknown, ctx: ActionContext<DB>) => Promise<ActionResult>;
}

/**
 * Action declared on a dashboard, rendered in the dashboard page header.
 *
 * Mirrors `RowAction` minus the row-bound `disabled(row)` / `hidden(row)`
 * callbacks (a dashboard isn't bound to a row). Visibility / enablement
 * are session-aware via `requireRole` only. Triggered via
 * `POST /api/flowpanel/dashboards/<encoded-path>/actions/<key>`.
 *
 * @example
 * ```ts
 * dashboard({
 *   path: "/pipeline",
 *   label: "Pipeline",
 *   sections: [...],
 *   actions: [{
 *     key: "trigger-scraper",
 *     label: "Run scraper now",
 *     variant: "default",
 *     confirm: "Trigger an out-of-band scrape?",
 *     requireRole: "admin",
 *     run: async (_input, ctx) => {
 *       await ctx.publish("scrape:trigger");
 *       return { ok: true, message: "Scrape queued" };
 *     },
 *   }],
 * })
 * ```
 */
export interface DashboardAction<DB = InferDB> {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive" | "success";
  confirm?: string | { title: string; description?: string; confirmLabel?: string };
  /**
   * Form schema rendered before invoking the action.
   *
   * This is a form schema, not a row schema: a dashboard action is not bound
   * to a row, so there is no `Row` type to key field names against. We use
   * `Record<string, unknown>` as the row type so `FieldDef.name` resolves to
   * `string` and consumers can supply arbitrary literal field names (e.g.
   * `{ name: "queue", type: "select", ... }`).
   */
  form?: FieldDef<Record<string, unknown>>[];
  requireRole?: string | string[];
  run: (input: unknown, ctx: ActionContext<DB>) => Promise<ActionResult>;
}
