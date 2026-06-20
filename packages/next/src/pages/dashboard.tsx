import type {
  DashboardConfig,
  DateRangePreset,
  ResolvedAdminConfig,
  Session,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  DashboardActionsBar,
  DashboardDateRange,
  WidgetErrorBoundary,
} from "@flowpanel/next/client";
import { RealtimeRefresh, Section, SkeletonCard, spanClass } from "@flowpanel/react";
import { Suspense } from "react";
import { encodeDashboardPath, serializeDashboardAction } from "../actions/dashboard-action.js";
import { type DateRangeInput, resolveDateRange } from "../runtime/date-range.js";
import { renderWidget } from "../runtime/render-widget.js";

export interface DashboardPageProps {
  config: ResolvedAdminConfig;
  dashboard: DashboardConfig;
  searchParams: URLSearchParams;
  req: Request;
  session: Session | null;
}

const PRESETS: readonly DateRangePreset[] = [
  "today",
  "yesterday",
  "last7d",
  "last30d",
  "MTD",
  "QTD",
  "YTD",
];

function parsePreset(value: string | null): DateRangePreset | undefined {
  if (!value) return undefined;
  return (PRESETS as readonly string[]).includes(value) ? (value as DateRangePreset) : undefined;
}

/** Whether the default `DashboardActionsBar` should render. */
export function shouldRenderActionsBar(
  actionsCount: number,
  hideActionsBar: boolean | undefined,
): boolean {
  return actionsCount > 0 && !hideActionsBar;
}

export function resolveDashboardDateRangeInput(
  dashboardDateRange: DashboardConfig["dateRange"],
  searchParams: URLSearchParams,
): DateRangeInput {
  const urlPreset = parsePreset(searchParams.get("preset"));
  const urlFrom = searchParams.get("from");
  const urlTo = searchParams.get("to");
  const effectivePreset = urlPreset ?? dashboardDateRange?.preset;
  const defaultRange = dashboardDateRange?.default;
  const useDefaultRange = !effectivePreset && !urlFrom && !urlTo && defaultRange !== undefined;
  return {
    ...(effectivePreset ? { preset: effectivePreset } : {}),
    ...(urlFrom ? { from: urlFrom } : {}),
    ...(urlTo ? { to: urlTo } : {}),
    ...(useDefaultRange && defaultRange ? { from: defaultRange.from, to: defaultRange.to } : {}),
  };
}

export async function DashboardPage({
  config,
  dashboard,
  searchParams,
  req,
  session,
}: DashboardPageProps) {
  const dateRangeInput = resolveDashboardDateRangeInput(dashboard.dateRange, searchParams);
  const effectivePreset = dateRangeInput.preset;
  const dateRange = resolveDateRange(dateRangeInput);
  const ctx: WidgetContext = {
    db: (config.adapter as { db: unknown }).db,
    session,
    dateRange,
    req,
  };

  const actions = (dashboard.actions ?? []).map(serializeDashboardAction);
  const encodedPath = encodeDashboardPath(dashboard.path);

  return (
    <div className="space-y-8">
      {dashboard.realtime ? <RealtimeRefresh channels={dashboard.realtime} /> : null}
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-fp-text-1">{dashboard.label}</h1>
        <div className="flex items-center gap-3">
          {shouldRenderActionsBar(actions.length, dashboard.hideActionsBar) ? (
            <DashboardActionsBar encodedPath={encodedPath} actions={actions} />
          ) : null}
          <DashboardDateRange {...(effectivePreset ? { preset: effectivePreset } : {})} />
        </div>
      </header>
      {dashboard.sections.map((sec, idx) => (
        <Section
          // biome-ignore lint/suspicious/noArrayIndexKey: section order is stable
          key={`${idx}-${sec.label ?? ""}`}
          {...(sec.label ? { label: sec.label } : {})}
          {...(sec.description ? { description: sec.description } : {})}
          columns={sec.columns ?? 1}
        >
          {sec.widgets.map((w, wIdx) => (
            <WidgetSlot
              // biome-ignore lint/suspicious/noArrayIndexKey: widget order is stable
              key={wIdx}
              widget={w}
              ctx={ctx}
              config={config}
              dashboardPath={dashboard.path}
              widgetIndex={`s${idx}.w${wIdx}`}
            />
          ))}
        </Section>
      ))}
    </div>
  );
}

function WidgetSlot({
  widget,
  ctx,
  config,
  dashboardPath,
  widgetIndex,
}: {
  widget: WidgetConfig;
  ctx: WidgetContext;
  config: ResolvedAdminConfig;
  dashboardPath: string;
  widgetIndex: string;
}) {
  const className = widgetSpanClassName(widget);
  return (
    <div {...(className ? { className } : {})}>
      <WidgetErrorBoundary widgetId={widgetIndex} dashboardId={dashboardPath}>
        <Suspense fallback={<SkeletonCard />}>
          <WidgetAsync widget={widget} ctx={ctx} config={config} />
        </Suspense>
      </WidgetErrorBoundary>
    </div>
  );
}

export function widgetSpanClassName(widget: WidgetConfig): string | undefined {
  const span = widget.options.span;
  return span ? spanClass[span] : undefined;
}

async function WidgetAsync({
  widget,
  ctx,
  config,
}: {
  widget: WidgetConfig;
  ctx: WidgetContext;
  config: ResolvedAdminConfig;
}) {
  return <>{await renderWidget(widget, ctx, config)}</>;
}
