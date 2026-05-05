import type {
  ListQueryContext,
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
      let rows: unknown[] = [];
      if (widget.options.query) {
        rows = await widget.options.query(ctx);
      } else if (widget.options.resource) {
        const res = config.resourcesByName.get(widget.options.resource);
        if (res) {
          const softDelete = res.options.delete?.softDelete;
          const listCtx: ListQueryContext<Record<string, unknown>> = {
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
          rows = r.rows;
        }
      }
      const keys = widget.options.columns ?? (rows[0] ? Object.keys(rows[0] as object) : []);
      return (
        <TableWidgetRenderer
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={rows as Record<string, unknown>[]}
          columns={keys.map((k) => ({ field: k, label: k }))}
          rowKey={"id"}
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
        const chartsMod: { renderChart: (w: WidgetConfig, data: unknown) => ReactNode } =
          // biome-ignore lint/suspicious/noExplicitAny: dynamic import surface not typed in Phase 2
          (await import("@flowpanel/charts/runtime" as any)) as any;
        const data = await widget.query(ctx);
        return chartsMod.renderChart(widget, data);
      } catch {
        return (
          <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 text-xs text-fp-text-3">
            Charts package not installed — run `pnpm add @flowpanel/charts`.
          </div>
        );
      }
    }
  }
}
