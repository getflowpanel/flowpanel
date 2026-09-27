import type {
  DashboardConfig,
  DateRangePreset,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import {
  DashboardActionsBar,
  DashboardDateRange,
  DashboardFilters,
  WidgetErrorBoundary,
} from "@flowpanel/next/client";
import {
  DashboardRefresh,
  RealtimeRefresh,
  Section,
  SkeletonCard,
  StatStrip,
} from "@flowpanel/react";
import { Suspense } from "react";
import { encodeDashboardPath, serializeDashboardAction } from "../actions/dashboard-action";
import { filterActionsByAccess } from "../runtime/action-helpers";
import { activeFilters, filterChoices } from "../runtime/dashboard-filters";
import {
  DATE_RANGE_PRESETS,
  type DateRangeInput,
  readableDate,
  resolveDateRange,
} from "../runtime/date-range";
import { realtimeChannels } from "../runtime/realtime-channels";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";
import {
  describeOwner,
  type PageTimer,
  pageTimer,
  type WidgetOwner,
  widgetOwner,
} from "../runtime/widget-owner";
import { warnOnce } from "../runtime/widget-reads";
import { stripWidget } from "./strip-widget";
import { sectionColumns, widgetSlotClassName } from "./widget-slot";

export interface DashboardPageProps {
  config: ResolvedAdminConfig;
  dashboard: DashboardConfig;
  searchParams: URLSearchParams;
  req: Request;
  reqCtx: RequestContext;
}

function parsePreset(
  value: string | null,
  offered: readonly DateRangePreset[],
): DateRangePreset | undefined {
  if (!value) return undefined;
  return (offered as readonly string[]).includes(value) ? (value as DateRangePreset) : undefined;
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
  const offered = dashboardDateRange?.presets ?? DATE_RANGE_PRESETS;
  const urlPreset = parsePreset(searchParams.get("preset"), offered);
  const bounds = [searchParams.get("from"), searchParams.get("to")];
  const readable = bounds.every((bound) => bound === null || readableDate(bound) !== null);
  const [urlFrom, urlTo] = readable ? bounds : [null, null];
  const declared = dashboardDateRange?.preset;
  const defaultRange = dashboardDateRange?.default;
  if (declared && !offered.includes(declared)) {
    warnOnce(
      `preset-outside:${declared}`,
      `dateRange.preset "${declared}" is not among dateRange.presets, so the picker starts elsewhere.`,
    );
  }
  const configured =
    declared && offered.includes(declared)
      ? declared
      : defaultRange === undefined
        ? dashboardDateRange?.presets?.[0]
        : undefined;
  const effectivePreset = urlPreset ?? configured;
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
  const dateRange = resolveDateRange(dateRangeInput, resolveFormatting(config.formatting).timeZone);
  const shownPreset = dateRange.preset === "custom" ? undefined : dateRange.preset;
  const filters = activeFilters(dashboard, searchParams);
  const ctx: WidgetContext = buildWidgetContext(
    config,
    reqCtx,
    req,
    dateRange,
    undefined,
    undefined,
    undefined,
    filters,
  );
  const choices = await filterChoices(dashboard, ctx);
  const widgets = dashboard.sections.reduce((total, section) => total + section.widgets.length, 0);
  const timer = pageTimer(dashboard.path, widgets);
  const refreshMs = dashboardRefreshMs(dashboard.refresh);

  const actions = (await filterActionsByAccess(dashboard.actions, reqCtx)).map(
    serializeDashboardAction,
  );
  const encodedPath = encodeDashboardPath(dashboard.path);

  return (
    <div className="space-y-5">
      {dashboard.realtime ? (
        <RealtimeRefresh channels={realtimeChannels(dashboard.realtime)} />
      ) : null}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold text-fp-text-1">{dashboard.label}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {shouldRenderActionsBar(actions.length, dashboard.hideActionsBar) ? (
            <DashboardActionsBar encodedPath={encodedPath} actions={actions} />
          ) : null}
          {choices.length > 0 ? <DashboardFilters filters={choices} /> : null}
          <DashboardDateRange
            {...(shownPreset
              ? { preset: shownPreset }
              : { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() })}
            {...(dashboard.dateRange?.presets ? { presets: dashboard.dateRange.presets } : {})}
          />
          {refreshMs !== null ? (
            <DashboardRefresh intervalMs={refreshMs} renderedAt={Date.now()} />
          ) : null}
        </div>
      </header>
      {dashboard.sections.map((sec, idx) => {
        const strip = sec.variant === "strip";
        const slots = sec.widgets.map((w, wIdx) => (
          <WidgetSlot
            // biome-ignore lint/suspicious/noArrayIndexKey: widget order is stable
            key={wIdx}
            widget={w}
            ctx={ctx}
            config={config}
            reqCtx={reqCtx}
            dashboardPath={dashboard.path}
            owner={widgetOwner(w, dashboard.path, `section ${idx + 1} widget ${wIdx + 1}`)}
            timer={timer}
            plain={strip && stripWidget(w, `dashboard "${dashboard.path}"`, idx + 1)}
          />
        ));
        const heading = {
          ...(sec.label ? { label: sec.label } : {}),
          ...(sec.description ? { description: sec.description } : {}),
        };
        return strip ? (
          <StatStrip
            // biome-ignore lint/suspicious/noArrayIndexKey: section order is stable
            key={`${idx}-${sec.label ?? ""}`}
            {...heading}
            {...(sec.columns !== undefined && sec.columns !== 12 ? { columns: sec.columns } : {})}
          >
            {slots}
          </StatStrip>
        ) : (
          <Section
            // biome-ignore lint/suspicious/noArrayIndexKey: section order is stable
            key={`${idx}-${sec.label ?? ""}`}
            {...heading}
            columns={sectionColumns(sec.columns, sec.widgets, 1)}
          >
            {slots}
          </Section>
        );
      })}
    </div>
  );
}

interface SlotProps {
  widget: WidgetConfig;
  ctx: WidgetContext;
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
  owner: WidgetOwner;
  timer: PageTimer;
  plain?: boolean;
}

function WidgetSlot({ dashboardPath, ...slot }: SlotProps & { dashboardPath: string }) {
  return (
    <div className={slot.plain ? "flex min-w-0" : widgetSlotClassName(slot.widget)}>
      <WidgetErrorBoundary
        widgetId={describeOwner(slot.owner)}
        dashboardId={dashboardPath}
        {...(slot.plain ? { plain: true } : {})}
      >
        <Suspense fallback={<SkeletonCard />}>
          <WidgetAsync {...slot} />
        </Suspense>
      </WidgetErrorBoundary>
    </div>
  );
}

async function WidgetAsync({ widget, ctx, config, reqCtx, owner, timer, plain }: SlotProps) {
  return (
    <>
      {
        await timer.run(owner, () =>
          renderWidget(widget, ctx, config, reqCtx, { plain: plain === true }),
        )
      }
    </>
  );
}
