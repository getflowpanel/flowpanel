import type {
  MetricDelta,
  MetricResult,
  MetricWidget,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import { declaredListFields, filterShapeProblem } from "@flowpanel/core/internal";
import { MetricCard } from "@flowpanel/react";
import type { ReactNode } from "react";
import { resolveLink } from "./resolve-link";
import { thresholdTone } from "./threshold-tone";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";
import { comparisonRange, rangedContext } from "./widget-context";
import { columnsOf, warnOnce } from "./widget-reads";

type CompareOptions = Exclude<NonNullable<MetricWidget["options"]["compare"]>, boolean>;

function asResult(produced: number | string | MetricResult): MetricResult {
  return typeof produced === "object" && produced !== null ? produced : { value: produced };
}

function compareOptions(widget: MetricWidget): CompareOptions {
  return typeof widget.options.compare === "object" ? widget.options.compare : {};
}

function previousResult(widget: MetricWidget, ctx: WidgetContext): Promise<MetricResult> | null {
  if (!widget.options.compare) return null;
  const range = comparisonRange(ctx, compareOptions(widget).against);
  if (range === null) return null;
  return widget.query(rangedContext(ctx, { ...range, preset: "custom" })).then(asResult);
}

function comparedDelta(
  widget: MetricWidget,
  ctx: WidgetContext,
  current: MetricResult,
  before: MetricResult | null,
): MetricDelta | null {
  if (before === null || typeof current.value !== "number" || typeof before.value !== "number") {
    return null;
  }
  const { against } = compareOptions(widget);
  const value =
    before.value === 0
      ? Math.sign(current.value)
      : (current.value - before.value) / Math.abs(before.value);
  return {
    value,
    vs: against === "weekAgo" ? ctx.labels.widget.vsWeekAgo : ctx.labels.widget.vsPrevious,
    previous: before.value,
  };
}

function warnOnMismatch(
  widget: MetricWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
): void {
  const source = widget.source;
  if (process.env.NODE_ENV === "production" || !source?.linked) return;
  if (typeof source.where !== "function") return;
  const target = config.resourcesByName.get(source.resource);
  if (!target) return;
  const known = columnsOf(config, target).length > 0;
  const declared = declaredListFields(target.options);
  for (const [field, value] of Object.entries(source.where(ctx))) {
    if (known && !declared.has(field)) {
      warnOnce(
        `drilldown:${widget.label}:${field}`,
        `metric "${widget.label}" counts "${source.resource}" by "${field}", which its list does not ` +
          `declare, so its link opens every row. Add "${field}" to that resource's columns or filters, ` +
          "or give the card a drilldown.",
      );
      continue;
    }
    const problem = filterShapeProblem(target, field, value);
    if (!problem) continue;
    warnOnce(
      `drilldown:${widget.label}:${field}`,
      `metric "${widget.label}" counts "${source.resource}" by "${field}", but ${problem}, so its ` +
        "link opens other rows than it counted. Declare that filter, or give the card a drilldown.",
    );
  }
}

/** A `metric()` card: its query, an optional delta, and the period before it with `compare`. */
export async function renderMetric(
  widget: MetricWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  plain = false,
  caption: CaptionPromise = NO_CAPTION,
): Promise<ReactNode> {
  const [produced, queriedDelta, sparkline, before, captionLine] = await Promise.all([
    widget.query(ctx),
    widget.options.delta ? widget.options.delta(ctx) : Promise.resolve(null),
    widget.options.sparkline ? widget.options.sparkline(ctx) : Promise.resolve(undefined),
    previousResult(widget, ctx),
    caption,
  ]);
  const result = asResult(produced);
  const found = result.delta ?? queriedDelta ?? comparedDelta(widget, ctx, result, before);
  const goodWhen = found?.goodWhen ?? widget.options.goodWhen;
  const delta = found && goodWhen ? { ...found, goodWhen } : found;
  const sublabel = result.sublabel ?? widget.options.sublabel;
  const tone =
    result.tone ??
    widget.options.tone ??
    thresholdTone(result.value, widget.options.tones, result.volume, widget.options.goodWhen);
  if (result.href === undefined) warnOnMismatch(widget, ctx, config);
  const drilldown = resolveLink(config, ctx, result.href ?? widget.options.drilldown);
  return (
    <MetricCard
      label={widget.label}
      value={result.value}
      {...(widget.options.format ? { format: widget.options.format } : {})}
      {...(sublabel ? { sublabel } : {})}
      delta={delta}
      {...(sparkline ? { sparkline } : {})}
      {...(tone ? { tone } : {})}
      {...(drilldown ? { drilldown } : {})}
      {...(widget.options.icon ? { icon: widget.options.icon } : {})}
      {...(plain ? { plain: true } : {})}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
}
