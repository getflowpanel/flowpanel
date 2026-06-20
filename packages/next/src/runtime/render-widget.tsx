import type {
  ColumnDef,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  MetricCard,
  RealtimeRefresh,
  StatGroupCard,
  TableWidget as TableWidgetRenderer,
} from "@flowpanel/react";
import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { ServerCard } from "./_server-card.js";
import { prerenderResourceCells } from "./prerender-cells.js";
import { projectRow } from "./project-row.js";
import { buildRequestContext } from "./request-setup.js";
import { scopeBinding } from "./scope-binding.js";

/** Render a widget on the server. */
export async function renderWidget(
  widget: WidgetConfig,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
): Promise<ReactNode> {
  switch (widget.kind) {
    case "metric": {
      const [value, delta] = await Promise.all([
        widget.query(ctx),
        widget.options.delta ? widget.options.delta(ctx) : Promise.resolve(null),
      ]);
      const sparkline = widget.options.sparkline ? await widget.options.sparkline(ctx) : undefined;
      return (
        <Fragment>
          <MetricCard
            label={widget.label}
            value={value}
            {...(widget.options.format ? { format: widget.options.format } : {})}
            {...(widget.options.sublabel ? { sublabel: widget.options.sublabel } : {})}
            delta={delta}
            {...(sparkline ? { sparkline } : {})}
            {...(widget.options.tone ? { tone: widget.options.tone } : {})}
            {...(widget.options.drilldown ? { drilldown: widget.options.drilldown } : {})}
            {...(widget.options.icon ? { icon: widget.options.icon } : {})}
          />
          {widget.options.realtime ? <RealtimeRefresh channels={widget.options.realtime} /> : null}
        </Fragment>
      );
    }
    case "statGroup": {
      const stats = await Promise.all(
        widget.options.stats.map(async (s) => {
          const value =
            typeof s.value === "function"
              ? await (s.value as (c: WidgetContext) => Promise<unknown>)(ctx)
              : s.value;
          return {
            label: s.label,
            value,
            ...(s.format ? { format: s.format } : {}),
            ...(s.tone ? { tone: s.tone } : {}),
          };
        }),
      );
      return (
        <Fragment>
          <StatGroupCard
            {...(widget.options.label ? { label: widget.options.label } : {})}
            stats={stats}
          />
          {widget.options.realtime ? <RealtimeRefresh channels={widget.options.realtime} /> : null}
        </Fragment>
      );
    }
    case "custom": {
      const props =
        typeof widget.props === "function"
          ? await (widget.props as (c: WidgetContext) => Promise<unknown>)(ctx)
          : widget.props;
      const Component = widget.Component as ComponentType<unknown>;
      const inner = createElement(Component, props as Record<string, unknown>);
      const framed = widget.options.frame === false ? inner : <ServerCard>{inner}</ServerCard>;
      return (
        <Fragment>
          {framed}
          {widget.options.realtime ? <RealtimeRefresh channels={widget.options.realtime} /> : null}
        </Fragment>
      );
    }
    case "table": {
      type Row = Record<string, unknown>;
      let rows: Row[] = [];
      let columns: { field: string; label?: string }[] = [];
      let prerenderedCells: (ReactNode | undefined)[][] | undefined;
      let boundResource: ResourceConfig | undefined;

      if (widget.options.query) {
        rows = (await widget.options.query(ctx)) as Row[];
      } else if (widget.options.resource) {
        const res = config.resourcesByName.get(widget.options.resource);
        if (res) {
          boundResource = res;
          const softDelete = res.options.delete?.softDelete;
          const reqCtxForList = await buildRequestContext({ req: ctx.req, config });
          const listCtx: ListQueryContext<unknown> = {
            ...reqCtxForList,
            db: ctx.db,
            dateRange: ctx.dateRange,
            searchParams: new URLSearchParams(),
            signal: new AbortController().signal,
            filters: {},
            sort: null,
            page: 1,
            pageSize: widget.options.limit ?? 10,
            search: "",
            ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
            ...scopeBinding(config, res, reqCtxForList),
          };
          const r = await config.adapter.list(res.ref, listCtx);
          rows = r.rows as Row[];

          if (!widget.options.columns || widget.options.columns.length === 0) {
            const reqCtx: RequestContext = {
              req: ctx.req,
              session: ctx.session,
              role: "",
              scope: null,
              ip: null,
              userAgent: null,
            };
            const prerendered = prerenderResourceCells<Row>(
              res.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>,
              rows,
              reqCtx,
              { dropHidden: true },
            );
            columns = prerendered.columns;
            prerenderedCells = prerendered.prerenderedCells;
          }
        }
      }

      if (widget.options.columns && widget.options.columns.length > 0) {
        columns = widget.options.columns.map((k) => ({ field: k }));
      } else if (columns.length === 0 && rows[0]) {
        columns = Object.keys(rows[0]).map((k) => ({ field: k }));
      }

      const clientRows = boundResource
        ? rows.map((r) =>
            projectRow(boundResource as ResourceConfig, r, [...columns.map((c) => c.field), "id"]),
          )
        : rows;

      return (
        <TableWidgetRenderer
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={clientRows}
          columns={columns.map((c) => ({
            field: c.field,
            ...(c.label ? { label: c.label } : {}),
          }))}
          rowKey={"id"}
          {...(prerenderedCells ? { prerenderedCells } : {})}
          {...(widget.options.realtime ? { realtime: widget.options.realtime } : {})}
          {...(widget.options.emptyState ? { emptyState: widget.options.emptyState } : {})}
        />
      );
    }
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
          <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 text-xs text-fp-text-3">
            Charts package not installed — run `pnpm add @flowpanel/charts`.
          </div>
        );
      }
      const data = await widget.query(ctx);
      const Renderer = chartsMod.ChartRenderer;
      return (
        <Fragment>
          <Renderer kind={widget.kind} label={widget.label} options={widget.options} data={data} />
          {widget.options.realtime ? <RealtimeRefresh channels={widget.options.realtime} /> : null}
        </Fragment>
      );
    }
  }
}
