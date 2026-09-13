import type {
  DashboardConfig,
  DateRangePreset,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  DashboardActionsBar,
  DashboardDateRange,
  WidgetErrorBoundary,
} from "@flowpanel/next/client";
import { DashboardRefresh, RealtimeRefresh, Section, SkeletonCard } from "@flowpanel/react";
import { Suspense } from "react";
import { encodeDashboardPath, serializeDashboardAction } from "../actions/dashboard-action";
import { filterActionsByAccess } from "../runtime/action-helpers";
import { type DateRangeInput, resolveDateRange } from "../runtime/date-range";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";
import { widgetSlotClassName } from "./widget-slot";

export interface DashboardPageProps {
  config: ResolvedAdminConfig;
  dashboard: DashboardConfig;
  searchParams: URLSearchParams;
  req: Request;
  reqCtx: RequestContext;
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

/** `"60s"` / `"5m"` as milliseconds; anything else means no automatic refresh. */
export function dashboardRefreshMs(refresh: DashboardConfig["refresh"]): number | null {
  if (!refresh) return null;
  const match = /^(\d+(?:\.\d+)?)(s|m)$/.exec(refresh);
  const amount = Number(match?.[1]);
  if (!match || !Number.isFinite(amount) || amount <= 0) return null;
  return match[2] === "m" ? amount * 60_000 : amount * 1000;
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
  reqCtx,
}: DashboardPageProps) {
  const dateRangeInput = resolveDashboardDateRangeInput(dashboard.dateRange, searchParams);
  const effectivePreset = dateRangeInput.preset;
  const dateRange = resolveDateRange(dateRangeInput);
  const ctx: WidgetContext = buildWidgetContext(config, reqCtx, req, dateRange);
  const refreshMs = dashboardRefreshMs(dashboard.refresh);

  const actions = (await filterActionsByAccess(dashboard.actions, reqCtx)).map(
    serializeDashboardAction,
  );
  const encodedPath = encodeDashboardPath(dashboard.path);

  return (
    <div className="space-y-5">
      {dashboard.realtime ? <RealtimeRefresh channels={dashboard.realtime} /> : null}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold text-fp-text-1">{dashboard.label}</h1>
        <div className="flex items-center gap-3">
          {shouldRenderActionsBar(actions.length, dashboard.hideActionsBar) ? (
            <DashboardActionsBar encodedPath={encodedPath} actions={actions} />
          ) : null}
          <DashboardDateRange {...(effectivePreset ? { preset: effectivePreset } : {})} />
          {refreshMs !== null ? (
            <DashboardRefresh intervalMs={refreshMs} renderedAt={Date.now()} />
          ) : null}
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
              reqCtx={reqCtx}
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
  reqCtx,
  dashboardPath,
  widgetIndex,
}: {
  widget: WidgetConfig;
  ctx: WidgetContext;
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
  dashboardPath: string;
  widgetIndex: string;
}) {
  const className = widgetSlotClassName(widget);
  return (
    <div className={className}>
      <WidgetErrorBoundary widgetId={widgetIndex} dashboardId={dashboardPath}>
        <Suspense fallback={<SkeletonCard />}>
          <WidgetAsync widget={widget} ctx={ctx} config={config} reqCtx={reqCtx} />
        </Suspense>
      </WidgetErrorBoundary>
    </div>
  );
}

async function WidgetAsync({
  widget,
  ctx,
  config,
  reqCtx,
}: {
  widget: WidgetConfig;
  ctx: WidgetContext;
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
}) {
  return <>{await renderWidget(widget, ctx, config, reqCtx)}</>;
}
