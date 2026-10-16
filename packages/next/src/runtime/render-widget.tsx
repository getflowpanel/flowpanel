import type {
  FunnelStep,
  RealtimeOption,
  RequestContext,
  ResolvedAdminConfig,
  WidgetCaption,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { accessAllows, OTHER_KEY, resolveFormatting } from "@flowpanel/core";
import {
  BarsCard,
  ExpiredCard,
  FunnelCard,
  KvCard,
  ListCard,
  RealtimeRefresh,
  StatCard,
  StatGroupCard,
} from "@flowpanel/react";
import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { ServerCard } from "./_server-card";
import { barRows } from "./bar-rows";
import { withFilterHrefs } from "./dashboard-filters";
import { filteredEmptyState } from "./filtered-empty";
import { listCardData } from "./list-card-data";
import { realtimeChannels } from "./realtime-channels";
import { scopedCountMetric } from "./record-scope";
import { renderChartWidget } from "./render-chart-widget";
import { renderChecklist } from "./render-checklist";
import { renderHeatmap } from "./render-heatmap";
import { renderMetric } from "./render-metric";
import { renderTableWidget } from "./render-table-widget";
import { renderTimeline } from "./render-timeline";
import { renderTracker } from "./render-tracker";
import { linkRows, resolveLink } from "./resolve-link";
import { statDisplay } from "./stat-result";
import { valueTone } from "./threshold-tone";
import { type CaptionPromise, expiredCaption, NO_CAPTION, widgetCaption } from "./widget-caption";
import { requestNow } from "./widget-context";
import { kvItems, resolveItem, statItemOf } from "./widget-items";
import { widgetLabel } from "./widget-owner";
import { retainedRange } from "./widget-range";
import { warnOnce } from "./widget-reads";

function withRealtime(node: ReactNode, value: RealtimeOption | undefined): ReactNode {
  const channels = realtimeChannels(value);
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
  if (!(await accessAllows(widget.options.access, reqCtx))) return null;
  const kept = retainedRange(widget, pickedCtx);
  if (kept.expired) {
    const title = widgetLabel(widget);
    return (
      <ExpiredCard
        {...(title ? { label: title } : {})}
        caption={expiredCaption(pickedCtx, kept.days)}
        {...(frame.plain ? { plain: true } : {})}
      />
    );
  }
  const ctx = kept.ctx;
  const pending: CaptionPromise =
    widget.kind === "custom" && widget.options.frame === false
      ? NO_CAPTION
      : widgetCaption(widget, kept, requestNow(pickedCtx));
  const captioned = async (): Promise<{ caption?: WidgetCaption }> => {
    const caption = await pending;
    return caption ? { caption } : {};
  };
  switch (widget.kind) {
    case "metric":
      return withRealtime(
        await renderMetric(
          scopedCountMetric(widget, ctx, config),
          ctx,
          config,
          frame.plain === true,
          pending,
        ),
        widget.options.realtime,
      );
    case "statGroup": {
      const stats = await Promise.all(widget.options.stats.map((s) => statItemOf(s, ctx, config)));
      return withRealtime(
        <StatGroupCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          stats={stats}
          {...(await captioned())}
        />,
        widget.options.realtime,
      );
    }
    case "stat": {
      const result = await resolveItem(widget.value, ctx);
      const hint = result.hint ?? widget.options.hint;
      const href = resolveLink(config, ctx, result.href ?? widget.options.href);
      const tone = valueTone(result, widget.options);
      return withRealtime(
        <StatCard
          label={widget.label}
          value={statDisplay(result.value)}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(hint ? { hint } : {})}
          {...(href ? { href } : {})}
          {...(tone ? { tone } : {})}
          {...(frame.plain ? { plain: true } : {})}
          {...(await captioned())}
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
          {...(await captioned())}
        />,
        widget.options.realtime,
      );
    }
    case "bars": {
      const rows = await barRows(widget, ctx);
      if (widget.options.filterOnClick && rows.some((row) => row.key === undefined)) {
        warnOnce(
          `bars-key:${widget.options.filterOnClick}`,
          `bars sets filterOnClick "${widget.options.filterOnClick}", but some rows carry no key, ` +
            "so clicking them does nothing; return key, or build the rows with breakdown().",
        );
      }
      return withRealtime(
        <BarsCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={withFilterHrefs(
            ctx,
            widget.options.filterOnClick,
            linkRows(config, ctx, rows),
            (row) => (row.key === undefined || row.key === OTHER_KEY ? null : row.key),
          )}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(widget.options.max !== undefined ? { max: widget.options.max } : {})}
          {...(widget.options.share ? { share: true } : {})}
          {...(widget.options.goodWhen ? { goodWhen: widget.options.goodWhen } : {})}
          emptyState={
            filteredEmptyState(ctx) ?? widget.options.emptyState ?? ctx.labels.widget.empty
          }
          {...(await captioned())}
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
          emptyState={
            filteredEmptyState(ctx) ?? widget.options.emptyState ?? ctx.labels.widget.empty
          }
          {...(await captioned())}
        />,
        widget.options.realtime,
      );
    }
    case "list": {
      const data = await listCardData(widget, ctx, config);
      const filteredQuiet =
        data.variant && data.rows.length === 0 && Object.keys(ctx.filters).length > 0;
      return withRealtime(
        <ListCard
          {...data}
          {...(data.variant
            ? filteredQuiet
              ? { allClear: ctx.labels.widget.filtered }
              : {}
            : { emptyState: filteredEmptyState(ctx) ?? data.emptyState })}
          {...(await captioned())}
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
      const caption = await pending;
      const card = (
        <ServerCard {...(label ? { label } : {})} {...(caption ? { caption } : {})}>
          {inner}
        </ServerCard>
      );
      const framed = widget.options.frame === false ? inner : card;
      const held =
        widget.options.minHeight === undefined ? (
          framed
        ) : (
          <div
            className="fp-flex fp-flex-col [&>*]:fp-flex-1"
            style={{ minHeight: widget.options.minHeight }}
          >
            {framed}
          </div>
        );
      return withRealtime(held, widget.options.realtime);
    }
    case "timeline":
      return withRealtime(
        await renderTimeline(widget, ctx, config, reqCtx, pending),
        widget.options.realtime,
      );
    case "tracker":
      return withRealtime(
        await renderTracker(widget, ctx, config, pending),
        widget.options.realtime,
      );
    case "heatmap":
      return withRealtime(
        await renderHeatmap(widget, ctx, config, reqCtx, pending),
        widget.options.realtime,
      );
    case "checklist":
      return withRealtime(
        await renderChecklist(widget, ctx, config, pending),
        widget.options.realtime,
      );
    case "table":
      return renderTableWidget(widget, ctx, config, reqCtx, pending);
    case "areaChart":
    case "barChart":
    case "lineChart":
    case "pieChart": {
      const chart = await renderChartWidget(widget, ctx, config, pending);
      return withRealtime(chart, widget.options.realtime);
    }
  }
}
