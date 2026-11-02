import type {
  EnumDef,
  RequestContext,
  ResolvedAdminConfig,
  TimelineEvent,
  TimelinePage,
  TimelineWidget,
  WidgetContext,
} from "@flowpanel/core";
import {
  mergeTimeline,
  pickedKinds,
  readTimelineCursor,
  timelineKindsOf,
} from "@flowpanel/core/internal";
import { TimelineCard } from "@flowpanel/react";
import type { ReactNode } from "react";
import { filteredEmptyState } from "./filtered-empty";
import { sourceEvents } from "./timeline-sources";
import { timelineCardProps } from "./timeline-view";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";

const PAGE_SIZE = 50;
const PAGE_SIZE_MAX = 200;

/** Every list of events one timeline page merges: the host `query`'s, then each source's. */
export async function timelineLists(
  widget: TimelineWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  page: TimelinePage,
  kinds: EnumDef,
): Promise<TimelineEvent[][]> {
  const { query, sources = [] } = widget.options;
  return Promise.all([
    ...(query ? [query(ctx, page)] : []),
    ...sources.map((source, index) =>
      sourceEvents(source, index, kinds, ctx, config, reqCtx, page),
    ),
  ]);
}

/** A `timeline()` card: one page of events, merged, grouped by day, with chips and paging. */
export async function renderTimeline(
  widget: TimelineWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  caption: CaptionPromise = NO_CAPTION,
): Promise<ReactNode> {
  const options = widget.options;
  const id = options.id ?? "timeline";
  const params = new URL(ctx.req.url).searchParams;
  const kinds = timelineKindsOf(options.kinds);
  const picked = pickedKinds(params.get(`${id}.kind`), kinds.values);
  const cursor = readTimelineCursor(params.get(`${id}.before`));
  const rawPageSize = Number.isFinite(options.pageSize) ? (options.pageSize as number) : PAGE_SIZE;
  const pageSize = Math.min(Math.max(Math.trunc(rawPageSize), 1), PAGE_SIZE_MAX);
  const page: TimelinePage = {
    before: cursor?.before ?? null,
    limit: pageSize + (cursor?.skip ?? 0) + 1,
    kinds: picked,
  };
  const [lists, captionLine] = await Promise.all([
    timelineLists(widget, ctx, config, reqCtx, page, kinds),
    caption,
  ]);
  const { events, next } = mergeTimeline(lists, cursor, pageSize, picked);
  return (
    <TimelineCard
      {...timelineCardProps({
        config,
        ctx,
        kinds,
        id,
        label: options.label,
        group: options.group ?? "day",
        picked,
        cursor,
        events,
        next,
        emptyState: filteredEmptyState(ctx) ?? options.emptyState ?? ctx.labels.widget.empty,
      })}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
}
