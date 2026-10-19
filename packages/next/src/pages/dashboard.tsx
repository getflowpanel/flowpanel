import type {
  DashboardConfig,
  DateRangePreset,
  RequestContext,
  ResolvedAdminConfig,
  SectionConfig,
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
import { DashboardRefresh, RealtimeRefresh, Section, StatStrip } from "@flowpanel/react";
import { Suspense } from "react";
import {
  encodeDashboardPath,
  serializeDashboardAction,
  warnManyPrimary,
} from "../actions/dashboard-action";
import { offeredDashboardActions } from "../runtime/action-gate";
import { activeFilters, filterChoices } from "../runtime/dashboard-filters";
import {
  DATE_RANGE_PRESETS,
  type DateRangeInput,
  readableDate,
  resolveDateRange,
} from "../runtime/date-range";
import { realtimeChannels } from "../runtime/realtime-channels";
import { renderWidget } from "../runtime/render-widget";
import { visibleWidgets } from "../runtime/widget-access";
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
import { widgetSkeleton } from "./widget-skeleton";
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
  const sections = (
    await Promise.all(
      dashboard.sections.map(async (section) => ({
        ...section,
        widgets: await visibleWidgets(section.widgets, reqCtx),
      })),
    )
  ).filter(
    (section, index) =>
      section.widgets.length > 0 || dashboard.sections[index]?.widgets.length === 0,
  );
  const widgets = sections.reduce((total, section) => total + section.widgets.length, 0);
  const timer = pageTimer(dashboard.path, widgets);
  const refreshMs = dashboardRefreshMs(dashboard.refresh);

  const actions = (await offeredDashboardActions(dashboard, reqCtx)).map(serializeDashboardAction);
  warnManyPrimary(actions, `dashboard "${dashboard.path}"`);
  const encodedPath = encodeDashboardPath(dashboard.path);

  return (
    <div className="fp-space-y-8">
      {dashboard.realtime ? (
        <RealtimeRefresh channels={realtimeChannels(dashboard.realtime)} />
      ) : null}
      <header className="fp-flex fp-flex-wrap fp-items-start fp-justify-between fp-gap-x-4 fp-gap-y-2">
        <h1 className="fp-text-2xl fp-font-semibold fp-tracking-tight fp-text-ink">
          {dashboard.label}
        </h1>
        <div className="fp-flex fp-flex-wrap fp-items-center fp-gap-3">
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
      {sections.map((sec, idx) => {
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
            {...(sec.align ? { align: sec.align } : {})}
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

function WidgetSlot({
  dashboardPath,
  align,
  ...slot
}: SlotProps & { dashboardPath: string; align?: SectionConfig["align"] }) {
  return (
    <div className={slot.plain ? "fp-flex fp-min-w-0" : widgetSlotClassName(slot.widget, align)}>
      <WidgetErrorBoundary
        widgetId={describeOwner(slot.owner)}
        dashboardId={dashboardPath}
        {...(slot.plain ? { plain: true } : {})}
        {...(slot.owner.label ? { title: slot.owner.label } : {})}
      >
        <Suspense fallback={widgetSkeleton(slot.widget)}>
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
