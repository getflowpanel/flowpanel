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
import { Section, SkeletonCard } from "@flowpanel/react";
import { Suspense } from "react";
import { encodeDashboardPath, serializeDashboardAction } from "../actions/dashboard-action.js";
import { resolveDateRange } from "../runtime/date-range.js";
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

/**
 * Whether the default `DashboardActionsBar` should render. Extracted as a
 * pure predicate so the conditional has a unit test independent of the
 * async server component shell.
 */
export function shouldRenderActionsBar(
  actionsCount: number,
  hideActionsBar: boolean | undefined,
): boolean {
  return actionsCount > 0 && !hideActionsBar;
}

export async function DashboardPage({
  config,
  dashboard,
  searchParams,
  req,
  session,
}: DashboardPageProps) {
  const urlPreset = parsePreset(searchParams.get("preset"));
  const dateRange = resolveDateRange({
    ...((urlPreset ?? dashboard.dateRange?.preset)
      ? { preset: (urlPreset ?? dashboard.dateRange?.preset) as DateRangePreset }
      : {}),
    ...(searchParams.get("from") ? { from: searchParams.get("from") as string } : {}),
    ...(searchParams.get("to") ? { to: searchParams.get("to") as string } : {}),
  });
  const ctx: WidgetContext = {
    db: (config.adapter as { db: unknown }).db,
    session,
    dateRange,
    req,
  };

  const actions = (dashboard.actions ?? []).map(serializeDashboardAction);
  const encodedPath = encodeDashboardPath(dashboard.path);

  return (
    <div className="space-y-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-fp-text-1">{dashboard.label}</h1>
        <div className="flex items-center gap-3">
          {shouldRenderActionsBar(actions.length, dashboard.hideActionsBar) ? (
            <DashboardActionsBar encodedPath={encodedPath} actions={actions} />
          ) : null}
          <DashboardDateRange
            {...((urlPreset ?? dashboard.dateRange?.preset)
              ? { preset: (urlPreset ?? dashboard.dateRange?.preset) as DateRangePreset }
              : {})}
          />
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
}: {
  widget: WidgetConfig;
  ctx: WidgetContext;
  config: ResolvedAdminConfig;
}) {
  return (
    <WidgetErrorBoundary>
      <Suspense fallback={<SkeletonCard />}>
        <WidgetAsync widget={widget} ctx={ctx} config={config} />
      </Suspense>
    </WidgetErrorBoundary>
  );
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
