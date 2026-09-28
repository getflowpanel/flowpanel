import type { CaptionOptions, WidgetCaption, WidgetConfig, WidgetContext } from "@flowpanel/core";
import { formatLabel } from "@flowpanel/core";

/** A caption still being computed, so it runs beside the widget's own query. */
export type CaptionPromise = Promise<WidgetCaption | undefined>;

export const NO_CAPTION: CaptionPromise = Promise.resolve(undefined);

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

const warned = new Set<string>();

function ageLimit(limit: string | undefined): number | null {
  if (limit === undefined) return null;
  const match = /^(\d+)([mhd])$/.exec(limit);
  if (match) return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
  if (process.env.NODE_ENV !== "production" && !warned.has(limit)) {
    warned.add(limit);
    console.warn(
      `[flowpanel] freshness.warnAfter "${limit}" is not a whole number of minutes, hours or days ` +
        'such as "30m", "2h" or "14d"; the caption never turns warn.',
    );
  }
  return null;
}

async function freshAt(
  at: (ctx: WidgetContext) => Promise<Date | null>,
  ctx: WidgetContext,
): Promise<Date | null> {
  try {
    return await at(ctx);
  } catch (error) {
    console.error("[flowpanel] freshness.at failed:", error);
    return null;
  }
}

/** The caption of a widget whose whole range lies before its retention horizon. */
export function expiredCaption(ctx: WidgetContext, days: number): WidgetCaption {
  return { text: formatLabel(ctx.labels.widget.expired, { days }) };
}

/** The one caption a card shows: where its range was cut, else how fresh its data is, else its coverage. */
export async function widgetCaption(
  widget: WidgetConfig,
  kept: { ctx: WidgetContext; keptSince: Date | null },
  now: number,
): CaptionPromise {
  const { ctx, keptSince } = kept;
  if (keptSince !== null) {
    return {
      text: formatLabel(ctx.labels.widget.keptSince, { date: ctx.format.date(keptSince) }),
      title: ctx.format.dateTime(keptSince),
    };
  }
  const { freshness, coverage } = widget.options as CaptionOptions;
  const at = freshness ? await freshAt(freshness.at, ctx) : null;
  if (freshness && at !== null) {
    const limit = ageLimit(freshness.warnAfter);
    return {
      text: formatLabel(ctx.labels.widget.dataAsOf, { time: ctx.format.dateTime(at) }),
      title: ctx.format.relative(at, new Date(now)),
      ...(limit !== null && now - at.getTime() > limit ? { tone: "warn" as const } : {}),
    };
  }
  return coverage ? { text: coverage } : undefined;
}
