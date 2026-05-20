import type {
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";

/**
 * Wire-safe shape of a drawer widget. Mirrors `WidgetConfig` but strips
 * non-serializable bits (function refs, React component refs) so the payload
 * can cross the route boundary.
 */
export type SerializedWidget =
  | {
      kind: "metric";
      label: string;
      value: number | string;
      format?: string;
      sublabel?: string;
      tone?: string;
      span?: number;
    }
  | {
      kind: "table";
      label?: string;
      rows: Record<string, unknown>[];
      columns: string[];
      span?: number;
    }
  | {
      kind: "statGroup";
      label?: string;
      stats: { label: string; value: unknown; format?: string; tone?: string }[];
      span?: number;
    }
  | {
      kind: "chart";
      subkind: "area" | "bar" | "line" | "pie";
      label: string;
      dataPoints: number;
      span?: number;
    }
  | { kind: "unsupported"; label?: string; reason: string; span?: number };

/**
 * Runs the widget's query (under the request context) and returns a
 * serialization-safe representation. Errors are caught and surfaced as
 * `{ kind: "unsupported" }` so a single bad widget doesn't fail the whole tab.
 */
export async function serializeWidget(
  w: WidgetConfig,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  widgetCtx: WidgetContext,
  req: Request,
): Promise<SerializedWidget> {
  try {
    switch (w.kind) {
      case "metric": {
        const value = await runWithRequestContext(reqCtx, () => w.query(widgetCtx));
        return {
          kind: "metric",
          label: w.label,
          value,
          ...(w.options.format ? { format: w.options.format } : {}),
          ...(w.options.sublabel ? { sublabel: w.options.sublabel } : {}),
          ...(w.options.tone ? { tone: w.options.tone } : {}),
          ...(w.options.span ? { span: w.options.span } : {}),
        };
      }
      case "table": {
        let rows: Record<string, unknown>[] = [];
        let columns: string[] = [];
        if (w.options.query) {
          const raw = (await runWithRequestContext(reqCtx, () =>
            w.options.query!(widgetCtx),
          )) as unknown[];
          rows = raw as Record<string, unknown>[];
        } else if (w.options.resource) {
          const target = config.resourcesByName.get(w.options.resource);
          if (target) {
            const softDelete = target.options.delete?.softDelete;
            const listCtx: ListQueryContext<unknown> = {
              ...reqCtx,
              req,
              db: config.adapter.db,
              dateRange: { from: new Date(0), to: new Date() },
              searchParams: new URLSearchParams(),
              signal: new AbortController().signal,
              filters: {},
              sort: null,
              page: 1,
              pageSize: w.options.limit ?? 10,
              search: "",
              ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
            };
            const r = await runWithRequestContext(reqCtx, () =>
              config.adapter.list(target.ref, listCtx),
            );
            rows = r.rows as Record<string, unknown>[];
            columns = (target.options.columns as unknown[])
              .map((c) =>
                typeof c === "string" ? c : String((c as { field?: string }).field ?? ""),
              )
              .filter(Boolean);
          }
        }
        if (w.options.columns && w.options.columns.length > 0) {
          columns = w.options.columns;
        } else if (columns.length === 0 && rows[0]) {
          columns = Object.keys(rows[0]);
        }
        return {
          kind: "table",
          ...(w.options.label ? { label: w.options.label } : {}),
          rows,
          columns,
          ...(w.options.span ? { span: w.options.span } : {}),
        };
      }
      case "statGroup": {
        const stats = await Promise.all(
          w.options.stats.map(async (s) => ({
            label: s.label,
            value:
              typeof s.value === "function"
                ? await runWithRequestContext(reqCtx, () =>
                    (s.value as (c: WidgetContext) => Promise<unknown>)(widgetCtx),
                  )
                : s.value,
            ...(s.format ? { format: s.format } : {}),
            ...(s.tone ? { tone: s.tone } : {}),
          })),
        );
        return {
          kind: "statGroup",
          ...(w.options.label ? { label: w.options.label } : {}),
          stats,
          ...(w.options.span ? { span: w.options.span } : {}),
        };
      }
      case "areaChart":
      case "barChart":
      case "lineChart":
      case "pieChart": {
        const data = (await runWithRequestContext(reqCtx, () => w.query(widgetCtx))) as unknown[];
        const subkind = (
          w.kind === "areaChart"
            ? "area"
            : w.kind === "barChart"
              ? "bar"
              : w.kind === "lineChart"
                ? "line"
                : "pie"
        ) as "area" | "bar" | "line" | "pie";
        return {
          kind: "chart",
          subkind,
          label: w.label,
          dataPoints: data.length,
          ...(w.options.span ? { span: w.options.span } : {}),
        };
      }
      default:
        // custom widgets — React component refs can't serialize through a
        // fetch boundary. Surface a clear message rather than a blank tile.
        return {
          kind: "unsupported",
          reason: "custom widgets are not supported in drawer tabs",
        };
    }
  } catch (err) {
    return {
      kind: "unsupported",
      reason: err instanceof Error ? err.message : "widget query failed",
    };
  }
}
