import {
  type EnumDef,
  formatCount,
  formatLabel,
  type ResolvedAdminConfig,
  resolveFormatting,
  type TimelineEvent,
  type WidgetContext,
} from "@flowpanel/core";
import {
  clockIn,
  dayKeyIn,
  groupTimeline,
  shiftDayKey,
  type TimelineCursor,
  writeTimelineCursor,
} from "@flowpanel/core/internal";
import type { TimelineCardGroup, TimelineCardLine, TimelineCardProps } from "@flowpanel/react";
import type { ReactNode } from "react";
import { resolveLink } from "./resolve-link";
import { requestNow } from "./widget-context";

function hrefWith(url: URL, set: Record<string, string | null>): string {
  const params = new URLSearchParams(url.searchParams);
  for (const [key, value] of Object.entries(set)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

interface View {
  config: ResolvedAdminConfig;
  ctx: WidgetContext;
  kinds: EnumDef;
  locale: string;
}

function lineOf(event: TimelineEvent, index: number, view: View): TimelineCardLine {
  const zone = view.ctx.dateRange.timeZone;
  const href =
    event.href === undefined ? undefined : resolveLink(view.config, view.ctx, event.href);
  const tone = event.tone ?? view.kinds.tone(event.kind);
  return {
    key: event.key ?? `${event.kind}:${event.at.getTime()}:${index}`,
    time: clockIn(event.at, zone, view.locale),
    stamp: view.ctx.format.dateTime(event.at),
    iso: event.at.toISOString(),
    title: event.title,
    ...(event.meta ? { meta: event.meta } : {}),
    ...(event.body ? { body: event.body } : {}),
    ...(tone !== "default" ? { tone } : {}),
    ...(href ? { href } : {}),
  };
}

function foldedLine(line: TimelineEvent[], index: number, view: View): TimelineCardLine {
  const newest = line[0] as TimelineEvent;
  const head = lineOf(newest, index, view);
  if (line.length === 1) return head;
  const oldest = line.at(-1) as TimelineEvent;
  const zone = view.ctx.dateRange.timeZone;
  const { href: _itemsCarryTheirOwn, ...rest } = head;
  return {
    ...rest,
    folded: formatLabel(view.ctx.labels.timeline.folded, { n: line.length }),
    span: `${clockIn(oldest.at, zone, view.locale)}–${clockIn(newest.at, zone, view.locale)}`,
    items: line.map((event, i) => lineOf(event, i, view)),
  };
}

function dayLabel(day: string | null, view: View): string {
  if (day === null) return "";
  const today = dayKeyIn(new Date(requestNow(view.ctx)), view.ctx.dateRange.timeZone);
  if (day === today) return view.ctx.labels.timeline.today;
  if (day === shiftDayKey(today, -1)) return view.ctx.labels.timeline.yesterday;
  return view.ctx.format.date(day);
}

function eventCount(n: number, view: View): string {
  const { labels } = view.ctx;
  const label =
    labels.plurals?.events ?? (n === 1 ? labels.timeline.event : labels.timeline.events);
  return formatCount(label, n, view.locale, view.ctx.format.number(n));
}

/** A timeline page as its card's props: chips, day groups, folded lines and paging links. */
export function timelineCardProps(args: {
  config: ResolvedAdminConfig;
  ctx: WidgetContext;
  kinds: EnumDef;
  id: string;
  label: string | undefined;
  group: "day" | false;
  picked: readonly string[] | null;
  cursor: TimelineCursor | null;
  events: TimelineEvent[];
  next: TimelineCursor | null;
  emptyState: ReactNode;
}): TimelineCardProps {
  const { ctx, kinds, id } = args;
  const view: View = {
    config: args.config,
    ctx,
    kinds,
    locale: resolveFormatting(args.config.formatting).locale,
  };
  const url = new URL(ctx.req.url);
  const chip = (kind: string | null) =>
    hrefWith(url, { [`${id}.kind`]: kind, [`${id}.before`]: null });
  const groups: TimelineCardGroup[] = groupTimeline(
    args.events,
    ctx.dateRange.timeZone,
    args.group,
  ).map((day, index) => ({
    key: day.day ?? `all-${index}`,
    label: dayLabel(day.day, view),
    count: eventCount(day.count, view),
    lines: day.lines.map((line, i) => foldedLine(line, i, view)),
  }));
  return {
    ...(args.label ? { label: args.label } : {}),
    chips: [
      { key: "", label: ctx.labels.timeline.all, href: chip(null), current: args.picked === null },
      ...kinds.values.map((kind) => ({
        key: kind,
        label: kinds.label(kind),
        href: chip(kind),
        current: args.picked?.length === 1 && args.picked[0] === kind,
      })),
    ],
    groups,
    emptyState: args.emptyState,
    ...(args.cursor
      ? {
          newest: {
            href: hrefWith(url, { [`${id}.before`]: null }),
            label: ctx.labels.timeline.newest,
          },
        }
      : {}),
    ...(args.next
      ? {
          older: {
            href: hrefWith(url, { [`${id}.before`]: writeTimelineCursor(args.next) }),
            label: ctx.labels.timeline.older,
          },
        }
      : {}),
  };
}
