import type {
  ColumnFormat,
  MetricResult,
  RequestContext,
  ResolvedAdminConfig,
  TableWidgetOptions,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { formatLabel, mergeLabels, runWithRequestContext } from "@flowpanel/core";
import type { CardDate } from "@flowpanel/react";
import { safeErrorMessage } from "../runtime/action-helpers";
import {
  declaredFieldName,
  filterReadableDeclarations,
  resolveReadableFieldSet,
} from "../runtime/readable-fields";
import { realtimeProp } from "../runtime/realtime-channels";
import { scopedCountMetric } from "../runtime/record-scope";
import { readRelatedRows } from "../runtime/require-authorized";
import { tableFilters } from "../runtime/table-filters";
import { thresholdTone } from "../runtime/threshold-tone";
import { expiredCaption } from "../runtime/widget-caption";
import { statItemOf } from "../runtime/widget-items";
import { widgetLabel } from "../runtime/widget-owner";
import { retainedRange } from "../runtime/widget-range";
import { type SerializedCardWidget, serializeCardWidget } from "./serialize-cards";

/** A widget column is a bare key or an object naming one; the wire needs the key. */
function columnFields(columns: TableWidgetOptions["columns"]): string[] {
  return (columns ?? []).map((column) => (typeof column === "string" ? column : column.field));
}

type DrawerColumn = { field: string; label?: string; format?: ColumnFormat };

/** A widget column as the drawer wire carries it: its key, label and format. */
function wireColumn(column: NonNullable<TableWidgetOptions["columns"]>[number]): DrawerColumn {
  if (typeof column === "string") return { field: column };
  return {
    field: column.field,
    ...(column.label ? { label: column.label } : {}),
    ...(column.format ? { format: column.format } : {}),
  };
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
      columns: DrawerColumn[];
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "statGroup";
      label?: string;
      stats: {
        label: string;
        value: string | number | CardDate;
        format?: string;
        tone?: string;
        href?: string;
      }[];
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

const CHART_SUBKIND = {
  areaChart: "area",
  barChart: "bar",
  lineChart: "line",
  pieChart: "pie",
} as const;

export async function serializeWidget(
  w: WidgetConfig,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  pickedCtx: WidgetContext,
): Promise<SerializedWidget> {
  const labels = mergeLabels(config.labels);
  const kept = retainedRange(w, pickedCtx);
  if (kept.expired) {
    const label = widgetLabel(w);
    return {
      kind: "list",
      ...(label ? { label } : {}),
      rows: [],
      emptyState: expiredCaption(pickedCtx, kept.days).text,
      ...(w.options.span ? { span: w.options.span } : {}),
    };
  }
  const widgetCtx = kept.ctx;
  try {
    switch (w.kind) {
      case "metric": {
        const scoped = scopedCountMetric(w, widgetCtx, config);
        const produced = await runWithRequestContext(reqCtx, () => scoped.query(widgetCtx));
        const result: MetricResult =
          typeof produced === "object" && produced !== null ? produced : { value: produced };
        const sublabel = result.sublabel ?? w.options.sublabel;
        const tone =
          result.tone ??
          w.options.tone ??
          thresholdTone(result.value, w.options.tones, result.volume, w.options.goodWhen);
        return {
          kind: "metric",
          label: w.label,
          value: result.value,
          ...(w.options.format ? { format: w.options.format } : {}),
          ...(sublabel ? { sublabel } : {}),
          ...(tone ? { tone } : {}),
          ...(w.options.span ? { span: w.options.span } : {}),
          ...realtimeProp(w.options.realtime),
        };
      }
      case "table": {
        let rows: Record<string, unknown>[] = [];
        let columns: DrawerColumn[] = [];
        let readableResourceFields: ReadonlySet<string> | null = null;
        const queryFn = w.options.query;
        if (queryFn) {
          const raw = (await runWithRequestContext(reqCtx, () => queryFn(widgetCtx))) as unknown[];
          rows = raw as Record<string, unknown>[];
        } else if (w.options.resource) {
          const target = config.resourcesByName.get(w.options.resource);
          const filters = target ? tableFilters(w.options, widgetCtx, config, target) : null;
          const related = !target
            ? null
            : filters === null
              ? []
              : await readRelatedRows(config, target, reqCtx, {
                  filters,
                  dateRange: widgetCtx.dateRange,
                  pageSize: w.options.limit ?? 10,
                  extraFields: columnFields(w.options.columns),
                });
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
                const col = c as {
                  field?: string;
                  label?: string;
                  format?: ColumnFormat;
                  hidden?: boolean;
                };
                if (col.hidden) return null;
                const field = String(col.field ?? "");
                if (!field) return null;
                return {
                  field,
                  ...(col.label ? { label: col.label } : {}),
                  ...(col.format ? { format: col.format } : {}),
                };
              })
              .filter((x): x is DrawerColumn => x !== null);
          }
        }
        if (w.options.columns && w.options.columns.length > 0) {
          columns = w.options.columns
            .map(wireColumn)
            .filter(
              (column) => !readableResourceFields || readableResourceFields.has(column.field),
            );
        } else if (columns.length === 0 && rows[0]) {
          columns = Object.keys(rows[0]).map((k) => ({ field: k }));
        }
        return {
          kind: "table",
          ...(w.options.label ? { label: w.options.label } : {}),
          rows,
          columns,
          ...(w.options.span ? { span: w.options.span } : {}),
          ...realtimeProp(w.options.realtime),
        };
      }
      case "statGroup": {
        const stats = await Promise.all(
          w.options.stats.map((s) => statItemOf(s, widgetCtx, config, reqCtx)),
        );
        return {
          kind: "statGroup",
          ...(w.options.label ? { label: w.options.label } : {}),
          stats,
          ...(w.options.span ? { span: w.options.span } : {}),
          ...realtimeProp(w.options.realtime),
        };
      }
      case "areaChart":
      case "barChart":
      case "lineChart":
      case "pieChart": {
        const data = (await runWithRequestContext(reqCtx, () => w.query(widgetCtx))) as unknown[];
        return {
          kind: "chart",
          subkind: CHART_SUBKIND[w.kind],
          label: w.label,
          dataPoints: data.length,
          ...(w.options.span ? { span: w.options.span } : {}),
          ...realtimeProp(w.options.realtime),
        };
      }
      default: {
        const card = await serializeCardWidget(w, config, reqCtx, widgetCtx);
        if (card) return card;
        return {
          kind: "unsupported",
          reason: formatLabel(labels.drawer.unsupported, { kind: w.kind }),
        };
      }
    }
  } catch (err) {
    const label = widgetLabel(w);
    return {
      kind: "unsupported",
      ...(label ? { label } : {}),
      reason: safeErrorMessage(err, labels.errors.widgetHint),
      failed: true,
    };
  }
}
