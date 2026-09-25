import type {
  BarRow,
  FunnelStep,
  ListRow,
  NumericFormat,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { resolveFormatting, runWithRequestContext } from "@flowpanel/core";
import { type LinkedRow, linkRows, resolveLink } from "../runtime/resolve-link";
import { statDisplay } from "../runtime/stat-result";
import { kvItems, resolveItem } from "../runtime/widget-items";

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
      rows: LinkedRow<BarRow>[];
      format?: NumericFormat;
      max?: number;
      share?: boolean;
      goodWhen?: "up" | "down" | "neutral";
      emptyState: string;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "funnel";
      label?: string;
      steps: LinkedRow<FunnelStep>[];
      format?: NumericFormat;
      alertDrop?: number;
      emptyState: string;
      span?: number;
      realtime?: string | string[];
    }
  | {
      kind: "list";
      label?: string;
      rows: LinkedRow<ListRow>[];
      emptyState: string;
      span?: number;
      realtime?: string | string[];
    };

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
      const formatting = resolveFormatting(config.formatting);
      const result = await resolveItem(w.value, ctx, reqCtx);
      const hint = result.hint ?? w.options.hint;
      const href = resolveLink(config, ctx, result.href ?? w.options.href);
      const tone = result.tone ?? w.options.tone;
      return {
        kind: "stat",
        label: w.label,
        value: statDisplay(result.value, formatting),
        ...(w.options.format ? { format: w.options.format } : {}),
        ...(hint ? { hint } : {}),
        ...(href ? { href } : {}),
        ...(tone ? { tone } : {}),
        ...common(w.options),
      };
    }
    case "kv": {
      const formatting = resolveFormatting(config.formatting);
      const items = await kvItems(w.options, ctx, formatting, config, reqCtx);
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
        rows: linkRows(
          config,
          ctx,
          await runWithRequestContext(reqCtx, () => w.options.query(ctx)),
        ),
        ...(w.options.format ? { format: w.options.format } : {}),
        ...(w.options.max !== undefined ? { max: w.options.max } : {}),
        ...(w.options.share ? { share: true } : {}),
        ...(w.options.goodWhen ? { goodWhen: w.options.goodWhen } : {}),
        emptyState: w.options.emptyState ?? ctx.labels.widget.empty,
        ...common(w.options),
      };
    case "funnel":
      return {
        kind: "funnel",
        ...(w.options.label ? { label: w.options.label } : {}),
        steps: linkRows(
          config,
          ctx,
          await runWithRequestContext(reqCtx, () => w.options.query(ctx)),
        ),
        ...(w.options.format ? { format: w.options.format } : {}),
        ...(w.options.alertDrop !== undefined ? { alertDrop: w.options.alertDrop } : {}),
        emptyState: w.options.emptyState ?? ctx.labels.widget.empty,
        ...common(w.options),
      };
    case "list":
      return {
        kind: "list",
        ...(w.options.label ? { label: w.options.label } : {}),
        rows: linkRows(
          config,
          ctx,
          await runWithRequestContext(reqCtx, () => w.options.query(ctx)),
        ),
        emptyState: w.options.emptyState ?? ctx.labels.widget.empty,
        ...common(w.options),
      };
    default:
      return null;
  }
}
