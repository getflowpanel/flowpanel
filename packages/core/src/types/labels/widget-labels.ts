/** Dashboard and detail-tab widget chrome. */
export interface WidgetLabels {
  /** Zero-row state shared by tables, cards and charts. */
  empty?: string;
  /** Link from a card heading to the full list. */
  seeAll?: string;
  /** Freshness stamp on a refreshing dashboard. Use `{ago}`. */
  updated?: string;
  justNow?: string;
  /** Use `{n}` for the second count. */
  secondsAgo?: string;
  /** Use `{n}` for the minute count. */
  minutesAgo?: string;
  /** Shown where a chart would be when @flowpanel/charts is missing. */
  chartsMissing?: string;
  /** The value a change is measured against, beside a metric's change. Use `{value}`. */
  previous?: string;
  /** A rate's change in percentage points. Use `{value}`. */
  points?: string;
  /** What a compared metric's change is measured against. */
  vsPrevious?: string;
  /** The same, for `compare: { against: "weekAgo" }`. */
  vsWeekAgo?: string;
}
