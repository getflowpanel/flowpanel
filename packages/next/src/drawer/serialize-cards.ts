import type {
  BarRow,
  ColumnFormat,
  FunnelStep,
  KvItem,
  ListRow,
  NumericFormat,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  StatValue,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  formatColumnValue,
  formatNumber,
  resolveFormatting,
  runWithRequestContext,
} from "@flowpanel/core";

/** Wire-safe shape of the card widgets a drawer renders with the dashboard's own components. */
export type SerializedCardWidget =
  | {
      kind: "stat";
      label: string;
      value: number | string;
      format?: NumericFormat;
      hint?: string;
      href?: string;
      tone?: string;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "kv";
      label?: string;
      items: { label: string; value: string; tone?: string; href?: string }[];
      columns?: 1 | 2;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "bars";
      label?: string;
      rows: BarRow[];
      format?: NumericFormat;
      emptyState: string;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "funnel";
      label?: string;
      steps: FunnelStep[];
      format?: NumericFormat;
      emptyState: string;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "list";
      label?: string;
      rows: ListRow[];
      emptyState: string;
      span?: number;
      realtime?: string | string[];
    };

async function resolveStat(
  value: StatValue | ((ctx: WidgetContext) => Promise<StatValue>),
  reqCtx: RequestContext,
  ctx: WidgetContext,
): Promise<StatValue> {
  return typeof value === "function"
    ? await runWithRequestContext(reqCtx, () => value(ctx))
    : value;
}

/** A `kv` item may name a column format or a numeric one; the wire carries a string. */
function kvDisplay(
  value: StatValue,
  format: ColumnFormat | NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string {
  if (value === null || value === undefined) return "—";
  if (format === undefined) return String(value);
  if (
    format === "currency" ||
    format === "percent" ||
    format === "bytes" ||
    format === "duration"
  ) {
    return typeof value === "number" ? formatNumber(value, format, formatting) : String(value);
  }
  return formatColumnValue(value, format, formatting);
}

/** `null` for a widget kind this module does not own. */
export async function serializeCardWidget(
  w: WidgetConfig,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  ctx: WidgetContext,
): Promise<SerializedCardWidget | null> {
  const common = (options: { span?: number; realtime?: string | string[] }) => ({
    ...(options.span ? { span: options.span } : {}),
    ...(options.realtime ? { realtime: options.realtime } : {}),
  });
  switch (w.kind) {
    case "stat": {
      const value = await resolveStat(w.value, reqCtx, ctx);
      return {
        kind: "stat",
        label: w.label,
        value: typeof value === "number" ? value : String(value ?? "—"),
        ...(w.options.format ? { format: w.options.format } : {}),
        ...(w.options.hint ? { hint: w.options.hint } : {}),
        ...(w.options.href ? { href: w.options.href } : {}),
        ...(w.options.tone ? { tone: w.options.tone } : {}),
        ...common(w.options),
      };
    }
    case "kv": {
      const formatting = resolveFormatting(config.formatting);
      const items = await Promise.all(
        w.options.items.map(async (item: KvItem) => ({
          label: item.label,
          value: kvDisplay(await resolveStat(item.value, reqCtx, ctx), item.format, formatting),
          ...(item.tone ? { tone: item.tone } : {}),
          ...(item.href ? { href: item.href } : {}),
        })),
      );
      return {
        kind: "kv",
        ...(w.options.label ? { label: w.options.label } : {}),
        items,
        ...(w.options.columns ? { columns: w.options.columns } : {}),
        ...common(w.options),
      };
    }
    case "bars":
      return {
        kind: "bars",
        ...(w.options.label ? { label: w.options.label } : {}),
        rows: await runWithRequestContext(reqCtx, () => w.options.query(ctx)),
        ...(w.options.format ? { format: w.options.format } : {}),
        emptyState: w.options.emptyState ?? ctx.labels.widget.empty,
        ...common(w.options),
      };
    case "funnel":
      return {
        kind: "funnel",
        ...(w.options.label ? { label: w.options.label } : {}),
        steps: await runWithRequestContext(reqCtx, () => w.options.query(ctx)),
        ...(w.options.format ? { format: w.options.format } : {}),
        emptyState: w.options.emptyState ?? ctx.labels.widget.empty,
        ...common(w.options),
      };
    case "list":
      return {
        kind: "list",
        ...(w.options.label ? { label: w.options.label } : {}),
        rows: await runWithRequestContext(reqCtx, () => w.options.query(ctx)),
        emptyState: w.options.emptyState ?? ctx.labels.widget.empty,
        ...common(w.options),
      };
    default:
      return null;
  }
}
