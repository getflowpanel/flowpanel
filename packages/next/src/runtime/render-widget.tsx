import type {
  ColumnDef,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  CustomWidget as CustomWidgetRenderer,
  MetricCard,
  StatGroupCard,
  TableWidget as TableWidgetRenderer,
} from "@flowpanel/react";
import type { ReactNode } from "react";
import { prerenderResourceCells } from "./prerender-cells.js";

/**
 * Render a widget on the server.
 *
 * The chart branch lazy-imports `@flowpanel/charts/runtime`. That package is
 * introduced in Phase 3; for now we handle the ImportError gracefully so the
 * dispatcher remains structurally complete and shippable in Phase 2.
 */
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
        <MetricCard
          label={widget.label}
          value={value}
          {...(widget.options.format ? { format: widget.options.format } : {})}
          {...(widget.options.sublabel ? { sublabel: widget.options.sublabel } : {})}
          delta={delta}
          {...(sparkline ? { sparkline } : {})}
          {...(widget.options.tone ? { tone: widget.options.tone } : {})}
          {...(widget.options.drilldown ? { drilldown: widget.options.drilldown } : {})}
        />
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
        <StatGroupCard
          {...(widget.options.label ? { label: widget.options.label } : {})}
          stats={stats}
        />
      );
    }
    case "custom": {
      const props =
        typeof widget.props === "function"
          ? await (widget.props as (c: WidgetContext) => Promise<unknown>)(ctx)
          : widget.props;
      return <CustomWidgetRenderer Component={widget.Component} props={props} frame />;
    }
    case "table": {
      type Row = Record<string, unknown>;
      let rows: Row[] = [];
      // Resolved column metadata for the rendered table. Sourced from the
      // resource's `columns` array when the widget targets a resource (so
      // labels like "Created at" replace raw `createdAt` headers); falls
      // back to `Object.keys(rows[0])` when there's no resource binding.
      let columns: { field: string; label?: string }[] = [];
      // Per-row, per-column server-prerendered ReactNode tree. Indexed
      // `[rowIndex][colIndex]` against the resolved `columns` order. Only
      // populated when at least one ColumnDef carries a `render` function —
      // executing those functions server-side is the whole point of this
      // payload, since function refs can't cross the RSC boundary.
      let prerenderedCells: (ReactNode | undefined)[][] | undefined;

      if (widget.options.query) {
        rows = (await widget.options.query(ctx)) as Row[];
      } else if (widget.options.resource) {
        const res = config.resourcesByName.get(widget.options.resource);
        if (res) {
          const softDelete = res.options.delete?.softDelete;
          const listCtx: ListQueryContext<unknown> = {
            req: ctx.req,
            session: ctx.session,
            role: "",
            scope: null,
            ip: null,
            userAgent: null,
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
          };
          const r = await config.adapter.list(res.ref, listCtx);
          rows = r.rows as Row[];

          // When the widget didn't pass an explicit `columns` override,
          // adopt the resource's column metadata (field + label + render).
          if (!widget.options.columns || widget.options.columns.length === 0) {
            // The widget context has no role/scope/ip/userAgent — synth
            // a best-effort RequestContext matching what the column
            // renderer would have seen on the dedicated list page.
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

      // Apply explicit `widget.options.columns` override (or fall back to
      // raw keys when neither resource nor override gave us anything).
      if (widget.options.columns && widget.options.columns.length > 0) {
        columns = widget.options.columns.map((k) => ({ field: k }));
      } else if (columns.length === 0 && rows[0]) {
        columns = Object.keys(rows[0]).map((k) => ({ field: k }));
      }

      return (
        <TableWidgetRenderer
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={rows}
          columns={columns.map((c) => ({
            field: c.field,
            ...(c.label ? { label: c.label } : {}),
          }))}
          rowKey={"id"}
          {...(prerenderedCells ? { prerenderedCells } : {})}
        />
      );
    }
    case "areaChart":
    case "barChart":
    case "lineChart":
    case "pieChart": {
      // Lazy-loaded from @flowpanel/charts to avoid pulling Recharts into the
      // main bundle. The package is introduced in Phase 3; until then, fall
      // back to a placeholder.
      try {
        const chartsMod: {
          // biome-ignore lint/suspicious/noExplicitAny: cross-package dynamic import
          ChartRenderer: (props: any) => ReactNode;
        } =
          // biome-ignore lint/suspicious/noExplicitAny: dynamic import surface not typed in Phase 2
          (await import("@flowpanel/charts/runtime" as any)) as any;
        const data = await widget.query(ctx);
        const Renderer = chartsMod.ChartRenderer;
        return (
          <Renderer kind={widget.kind} label={widget.label} options={widget.options} data={data} />
        );
      } catch (e) {
        console.error("[flowpanel/charts] dynamic import failed:", e);
        return (
          <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 text-xs text-fp-text-3">
            Charts package not installed — run `pnpm add @flowpanel/charts`.
          </div>
        );
      }
    }
  }
}
