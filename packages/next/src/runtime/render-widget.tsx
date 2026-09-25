import type {
  BarRow,
  FunnelStep,
  ListRow,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import {
  BarsCard,
  FunnelCard,
  KvCard,
  ListCard,
  RealtimeRefresh,
  StatCard,
  StatGroupCard,
} from "@flowpanel/react";
import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { ServerCard } from "./_server-card";
import { scopedCountMetric } from "./record-scope";
import { renderMetric } from "./render-metric";
import { renderTableWidget } from "./render-table-widget";
import { linkRows, resolveLink } from "./resolve-link";
import { statDisplay } from "./stat-result";
import { kvItems, resolveItem, statItemOf } from "./widget-items";
import { expiredCard, retainedRange } from "./widget-range";

function withRealtime(node: ReactNode, channels: string | string[] | undefined): ReactNode {
  return (
    <Fragment>
      {node}
      {channels ? <RealtimeRefresh channels={channels} /> : null}
    </Fragment>
  );
}

/** How a slot frames its widget: `plain` drops the card, inside a `StatStrip`. */
export interface WidgetFrame {
  plain?: boolean;
}

/** Render a widget on the server. */
export async function renderWidget(
  widget: WidgetConfig,
  pickedCtx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  frame: WidgetFrame = {},
): Promise<ReactNode> {
  const kept = retainedRange(widget, pickedCtx);
  if (kept.expired) return <ListCard {...expiredCard(widget, pickedCtx)} rows={[]} />;
  const ctx = kept.ctx;
  switch (widget.kind) {
    case "metric":
      return withRealtime(
        await renderMetric(
          scopedCountMetric(widget, ctx, config),
          ctx,
          config,
          frame.plain === true,
        ),
        widget.options.realtime,
      );
    case "statGroup": {
      const groupFormatting = resolveFormatting(config.formatting);
      const stats = await Promise.all(
        widget.options.stats.map((s) => statItemOf(s, ctx, groupFormatting, config)),
      );
      return withRealtime(
        <StatGroupCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          stats={stats}
        />,
        widget.options.realtime,
      );
    }
    case "stat": {
      const result = await resolveItem(widget.value, ctx);
      const statFormatting = resolveFormatting(config.formatting);
      const hint = result.hint ?? widget.options.hint;
      const href = resolveLink(config, ctx, result.href ?? widget.options.href);
      const tone = result.tone ?? widget.options.tone;
      return withRealtime(
        <StatCard
          label={widget.label}
          value={statDisplay(result.value, statFormatting)}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(hint ? { hint } : {})}
          {...(href ? { href } : {})}
          {...(tone ? { tone } : {})}
          {...(frame.plain ? { plain: true } : {})}
        />,
        widget.options.realtime,
      );
    }
    case "kv": {
      const formatting = resolveFormatting(config.formatting);
      const items = await kvItems(widget.options, ctx, formatting, config);
      return withRealtime(
        <KvCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          items={items}
          {...(widget.options.columns ? { columns: widget.options.columns } : {})}
        />,
        widget.options.realtime,
      );
    }
    case "bars": {
      const rows: BarRow[] = await widget.options.query(ctx);
      return withRealtime(
        <BarsCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={linkRows(config, ctx, rows)}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(widget.options.max !== undefined ? { max: widget.options.max } : {})}
          {...(widget.options.share ? { share: true } : {})}
          {...(widget.options.goodWhen ? { goodWhen: widget.options.goodWhen } : {})}
          emptyState={widget.options.emptyState ?? ctx.labels.widget.empty}
        />,
        widget.options.realtime,
      );
    }
    case "funnel": {
      const steps: FunnelStep[] = await widget.options.query(ctx);
      return withRealtime(
        <FunnelCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          steps={linkRows(config, ctx, steps)}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(widget.options.alertDrop !== undefined
            ? { alertDrop: widget.options.alertDrop }
            : {})}
          emptyState={widget.options.emptyState ?? ctx.labels.widget.empty}
        />,
        widget.options.realtime,
      );
    }
    case "list": {
      const rows: ListRow[] = await widget.options.query(ctx);
      return withRealtime(
        <ListCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={linkRows(config, ctx, rows)}
          emptyState={widget.options.emptyState ?? ctx.labels.widget.empty}
        />,
        widget.options.realtime,
      );
    }
    case "custom": {
      const props =
        typeof widget.props === "function"
          ? await (widget.props as (c: WidgetContext) => Promise<unknown>)(ctx)
          : widget.props;
      const Component = widget.Component as ComponentType<unknown>;
      const inner = createElement(Component, props as Record<string, unknown>);
      const label = widget.options.label;
      const card = <ServerCard {...(label ? { label } : {})}>{inner}</ServerCard>;
      const framed = widget.options.frame === false ? inner : card;
      return withRealtime(framed, widget.options.realtime);
    }
    case "table":
      return renderTableWidget(widget, ctx, config, reqCtx);
    case "areaChart":
    case "barChart":
    case "lineChart":
    case "pieChart": {
      let chartsMod: {
        // biome-ignore lint/suspicious/noExplicitAny: cross-package dynamic import
        ChartRenderer: (props: any) => ReactNode;
      };
      try {
        chartsMod =
          // biome-ignore lint/suspicious/noExplicitAny: dynamic import surface not typed
          (await import("@flowpanel/charts/runtime" as any)) as any;
      } catch (e) {
        console.error("[flowpanel/charts] dynamic import failed:", e);
        return (
          <div
            data-fp-error=""
            className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 text-xs text-fp-text-3"
          >
            {ctx.labels.widget.chartsMissing}
          </div>
        );
      }
      const data = await widget.query(ctx);
      const drilldown = resolveLink(config, ctx, widget.options.drilldown);
      const { drilldown: _drilldown, ...options } = widget.options;
      const Renderer = chartsMod.ChartRenderer;
      return withRealtime(
        <Renderer
          kind={widget.kind}
          label={widget.label}
          options={options}
          data={data}
          {...(drilldown ? { drilldown } : {})}
        />,
        widget.options.realtime,
      );
    }
  }
}
