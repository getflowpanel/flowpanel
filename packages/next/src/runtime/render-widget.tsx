import type {
  ColumnDef,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  MetricCard,
  RealtimeRefresh,
  ReferenceCell,
  StatGroupCard,
  TableWidget as TableWidgetRenderer,
} from "@flowpanel/react";
import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { ServerCard } from "./_server-card.js";
import { buildHref } from "./href.js";
import { type PrerenderedColumn, prerenderResourceCells } from "./prerender-cells.js";
import { readRelatedRows } from "./require-authorized.js";
import { resolveReferences } from "./resolve-references.js";

type WidgetRow = Record<string, unknown>;

/** Resource column defs, narrowed and reordered to an explicit widget column list. */
function pickWidgetColumns(
  declared: ReadonlyArray<string | ColumnDef<WidgetRow>>,
  wanted: string[] | undefined,
): ReadonlyArray<string | ColumnDef<WidgetRow>> {
  if (!wanted || wanted.length === 0) return declared;
  return wanted.map(
    (field) =>
      declared.find((c) => typeof c === "object" && c.field === field) ??
      declared.find((c) => c === field) ??
      field,
  );
}

/** A dashboard table has no sort handler and no inline-edit target — strip both affordances. */
function toWidgetColumn(c: PrerenderedColumn<WidgetRow>): PrerenderedColumn<WidgetRow> {
  const out: PrerenderedColumn<WidgetRow> = { field: c.field };
  if (c.label !== undefined) out.label = c.label;
  if (c.width !== undefined) out.width = c.width;
  if (c.align !== undefined) out.align = c.align;
  if (c.className !== undefined) out.className = c.className;
  if (c.type !== undefined) out.type = c.type;
  if (c.format !== undefined) out.format = c.format;
  return out;
}

/** Replace foreign-key cells with the referenced row's label, as the list page does. */
async function withReferenceCells(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  defs: ReadonlyArray<string | ColumnDef<WidgetRow>>,
  rows: WidgetRow[],
  columns: PrerenderedColumn<WidgetRow>[],
  prerenderedCells: (ReactNode | undefined)[][] | undefined,
): Promise<(ReactNode | undefined)[][] | undefined> {
  const fkLabels = await resolveReferences<WidgetRow>(config, reqCtx, defs, rows);
  if (fkLabels.size === 0) return prerenderedCells;
  const cells = prerenderedCells
    ? prerenderedCells.map((r) => r.slice())
    : rows.map(() => Array<ReactNode | undefined>(columns.length).fill(undefined));
  const colIdxByField = new Map(columns.map((c, i) => [c.field, i]));
  for (const def of defs) {
    if (typeof def !== "object") continue;
    const ref = def.reference;
    const field = String(def.field ?? "");
    if (!ref || !field) continue;
    const labelMap = fkLabels.get(field);
    const colIdx = colIdxByField.get(field);
    if (!labelMap || colIdx === undefined) continue;
    rows.forEach((row, rowIdx) => {
      const rowCells = cells[rowIdx];
      if (!rowCells) return;
      const raw = row[field];
      if (raw === null || raw === undefined) {
        rowCells[colIdx] = <span className="text-fp-text-3">—</span>;
        return;
      }
      const label = labelMap.get(String(raw));
      if (label === undefined) return;
      rowCells[colIdx] = (
        <ReferenceCell label={String(label)} href={buildHref(config, ref.resource, String(raw))} />
      );
    });
  }
  return cells;
}

/** Render a widget on the server. */
export async function renderWidget(
  widget: WidgetConfig,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
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
      type Row = WidgetRow;
      let rows: Row[] = [];
      let columns: PrerenderedColumn<Row>[] = [];
      let prerenderedCells: (ReactNode | undefined)[][] | undefined;

      const explicit = widget.options.columns;

      if (widget.options.query) {
        rows = (await widget.options.query(ctx)) as Row[];
      } else if (widget.options.resource) {
        const res = config.resourcesByName.get(widget.options.resource);
        if (res) {
          const related = await readRelatedRows(config, res, reqCtx, {
            dateRange: ctx.dateRange,
            pageSize: widget.options.limit ?? 10,
            extraFields: [...(explicit ?? []), "id"],
          });
          rows = (related ?? []) as Row[];

          if (related) {
            const defs = pickWidgetColumns(
              res.options.columns as ReadonlyArray<string | ColumnDef<Row>>,
              explicit,
            );
            const intro = config.adapter.introspect(res.ref);
            const metaByField = new Map(intro.columns.map((c) => [c.name, c]));
            const prerendered = prerenderResourceCells<Row>(defs, rows, reqCtx, {
              dropHidden: !explicit || explicit.length === 0,
              metaByField,
            });
            columns = prerendered.columns.map(toWidgetColumn);
            prerenderedCells = await withReferenceCells(
              config,
              reqCtx,
              defs,
              rows,
              columns,
              prerendered.prerenderedCells,
            );
          }
        }
      }

      if (columns.length === 0 && explicit && explicit.length > 0) {
        columns = explicit.map((k) => ({ field: k }));
      } else if (columns.length === 0 && rows[0]) {
        columns = Object.keys(rows[0]).map((k) => ({ field: k }));
      }

      return (
        <TableWidgetRenderer
          {...(widget.options.label ? { label: widget.options.label } : {})}
          rows={rows}
          columns={columns}
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
