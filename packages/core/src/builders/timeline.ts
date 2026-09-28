import type { ResourceName, RowOf } from "../types/registry";
import type { TimelineOptions, TimelineSource, TimelineWidget } from "../types/widget-timeline";

/** What happened, newest first, grouped by day, with a chip per kind and paging. */
export function timeline(options: TimelineOptions): TimelineWidget {
  return { kind: "timeline", options };
}

/** A resource read as timeline events; `at`, `kind`, `where` and `refs` are checked against its row. */
timeline.source = function source<N extends ResourceName>(
  resource: N,
  options: Omit<TimelineSource<RowOf<N>>, "resource">,
): TimelineSource {
  return { ...options, resource } as unknown as TimelineSource;
};
