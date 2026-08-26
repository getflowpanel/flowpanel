import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { safeErrorMessage } from "../runtime/action-helpers";
import { readRelatedRows } from "../runtime/require-authorized";

/** Wire-safe shape of a drawer widget. */
export type SerializedWidget =
  | {
      kind: "metric";
      label: string;
      value: number | string;
      format?: string;
      sublabel?: string;
      tone?: string;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "table";
      label?: string;
      rows: Record<string, unknown>[];
      /** Column descriptors. */
      columns: { field: string; label?: string }[];
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "statGroup";
      label?: string;
      stats: { label: string; value: unknown; format?: string; tone?: string }[];
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "chart";
      subkind: "area" | "bar" | "line" | "pie";
      label: string;
      dataPoints: number;
      span?: number;
      realtime?: string | string[];
    }
  | { kind: "unsupported"; label?: string; reason: string; span?: number };

export async function serializeWidget(
  w: WidgetConfig,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  widgetCtx: WidgetContext,
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
          ...(w.options.realtime ? { realtime: w.options.realtime } : {}),
        };
      }
      case "table": {
        let rows: Record<string, unknown>[] = [];
        let columns: { field: string; label?: string }[] = [];
        const queryFn = w.options.query;
        if (queryFn) {
          const raw = (await runWithRequestContext(reqCtx, () => queryFn(widgetCtx))) as unknown[];
          rows = raw as Record<string, unknown>[];
        } else if (w.options.resource) {
          const target = config.resourcesByName.get(w.options.resource);
          const related = target
            ? await readRelatedRows(config, target, reqCtx, {
                pageSize: w.options.limit ?? 10,
                extraFields: w.options.columns ?? [],
              })
            : null;
          if (target && related) {
            rows = related;
            columns = (target.options.columns as unknown[])
              .map((c) => {
                if (typeof c === "string") return { field: c };
                const col = c as { field?: string; label?: string; hidden?: boolean };
                if (col.hidden) return null;
                const field = String(col.field ?? "");
                if (!field) return null;
                return col.label ? { field, label: col.label } : { field };
              })
              .filter((x): x is { field: string; label?: string } => x !== null);
          }
        }
        if (w.options.columns && w.options.columns.length > 0) {
          columns = w.options.columns.map((k) => ({ field: k }));
        } else if (columns.length === 0 && rows[0]) {
          columns = Object.keys(rows[0]).map((k) => ({ field: k }));
        }
        return {
          kind: "table",
          ...(w.options.label ? { label: w.options.label } : {}),
          rows,
          columns,
          ...(w.options.span ? { span: w.options.span } : {}),
          ...(w.options.realtime ? { realtime: w.options.realtime } : {}),
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
          ...(w.options.realtime ? { realtime: w.options.realtime } : {}),
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
          ...(w.options.realtime ? { realtime: w.options.realtime } : {}),
        };
      }
      default:
        return {
          kind: "unsupported",
          reason: "custom widgets are not supported in drawer tabs",
        };
    }
  } catch (err) {
    return {
      kind: "unsupported",
      reason: safeErrorMessage(err, "widget query failed"),
    };
  }
}
