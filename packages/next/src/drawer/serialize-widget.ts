import type {
  MetricResult,
  RequestContext,
  ResolvedAdminConfig,
  StatValue,
  TableWidgetOptions,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { resolveFormatting, runWithRequestContext } from "@flowpanel/core";
import { safeErrorMessage } from "../runtime/action-helpers";
import {
  declaredFieldName,
  filterReadableDeclarations,
  resolveReadableFieldSet,
} from "../runtime/readable-fields";
import { readRelatedRows } from "../runtime/require-authorized";
import { statDisplay } from "../runtime/stat-result";
import { type SerializedCardWidget, serializeCardWidget } from "./serialize-cards";

/** A widget column is a bare key or an object naming one; the wire needs the key. */
function columnFields(columns: TableWidgetOptions["columns"]): string[] {
  return (columns ?? []).map((column) => (typeof column === "string" ? column : column.field));
}

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
      stats: { label: string; value: string | number; format?: string; tone?: string }[];
      span?: number;
      realtime?: string | string[];
    }
  | SerializedCardWidget
  | {
      kind: "chart";
      subkind: "area" | "bar" | "line" | "pie";
      label: string;
      dataPoints: number;
      span?: number;
      realtime?: string | string[];
    }
  | { kind: "unsupported"; label?: string; reason: string; failed?: true; span?: number };

export async function serializeWidget(
  w: WidgetConfig,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  widgetCtx: WidgetContext,
): Promise<SerializedWidget> {
  try {
    switch (w.kind) {
      case "metric": {
        const produced = await runWithRequestContext(reqCtx, () => w.query(widgetCtx));
        const result: MetricResult =
          typeof produced === "object" && produced !== null ? produced : { value: produced };
        const sublabel = result.sublabel ?? w.options.sublabel;
        const tone = result.tone ?? w.options.tone;
        return {
          kind: "metric",
          label: w.label,
          value: result.value,
          ...(w.options.format ? { format: w.options.format } : {}),
          ...(sublabel ? { sublabel } : {}),
          ...(tone ? { tone } : {}),
          ...(w.options.span ? { span: w.options.span } : {}),
          ...(w.options.realtime ? { realtime: w.options.realtime } : {}),
        };
      }
      case "table": {
        let rows: Record<string, unknown>[] = [];
        let columns: { field: string; label?: string }[] = [];
        let readableResourceFields: ReadonlySet<string> | null = null;
        const queryFn = w.options.query;
        if (queryFn) {
          const raw = (await runWithRequestContext(reqCtx, () => queryFn(widgetCtx))) as unknown[];
          rows = raw as Record<string, unknown>[];
        } else if (w.options.resource) {
          const target = config.resourcesByName.get(w.options.resource);
          const related = target
            ? await readRelatedRows(config, target, reqCtx, {
                pageSize: w.options.limit ?? 10,
                extraFields: columnFields(w.options.columns),
              })
            : null;
          if (!target || !related) {
            readableResourceFields = new Set();
          } else {
            const candidates = [
              ...(target.options.columns ?? []),
              ...columnFields(w.options.columns),
            ]
              .map(declaredFieldName)
              .filter((field): field is string => field !== null);
            readableResourceFields = await resolveReadableFieldSet(
              candidates,
              target.options.fieldAccess,
              reqCtx,
            );
            rows = related;
            columns = filterReadableDeclarations(
              target.options.columns,
              readableResourceFields ?? new Set(),
            )
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
          columns = columnFields(w.options.columns)
            .filter((field) => !readableResourceFields || readableResourceFields.has(field))
            .map((field) => ({ field }));
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
        const formatting = resolveFormatting(config.formatting);
        const stats = await Promise.all(
          w.options.stats.map(async (s) => ({
            label: s.label,
            value: statDisplay(
              typeof s.value === "function"
                ? await runWithRequestContext(reqCtx, () =>
                    (s.value as (c: WidgetContext) => Promise<StatValue>)(widgetCtx),
                  )
                : s.value,
              formatting,
            ),
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
      default: {
        const card = await serializeCardWidget(w, config, reqCtx, widgetCtx);
        if (card) return card;
        return {
          kind: "unsupported",
          reason: `${w.kind} widgets are not supported in drawers yet`,
        };
      }
    }
  } catch (err) {
    return {
      kind: "unsupported",
      reason: safeErrorMessage(err, "widget query failed"),
      failed: true,
    };
  }
}
