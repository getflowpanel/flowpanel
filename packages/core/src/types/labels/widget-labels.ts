/** Dashboard and detail-tab widget chrome. */
export interface WidgetLabels {
  /** A sparkline's accessible name. */
  trend?: string;
  /** Zero-row state shared by tables, cards and charts. */
  empty?: string;
  /** Link from a card heading to the full list. */
  seeAll?: string;
  /** Opens the folded rest of a long `kv` value. */
  showAll?: string;
  /** Freshness stamp on a refreshing dashboard. Use `{ago}`. */
  updated?: string;
  justNow?: string;
  /** Use `{n}` for the second count. */
  secondsAgo?: string;
  /** Use `{n}` for the minute count. */
  minutesAgo?: string;
  /** The value a change is measured against, beside a metric's change. Use `{value}`. */
  previous?: string;
  /** A rate's change in percentage points. Use `{value}`. */
  points?: string;
  /** A change from nothing in the compared period, where a percentage has no base. */
  fresh?: string;
  /** A metric's change too small to show, before what it is compared with. */
  noChange?: string;
  /** What a compared metric's change is measured against. */
  vsPrevious?: string;
  /** The same, for `compare: { against: "weekAgo" }`. */
  vsWeekAgo?: string;
  /** The series or bar that folds the smaller values of a `top` limit. */
  other?: string;
  /** An expired widget's caption: its whole range is older than `maxRange`. Use `{days}`. */
  expired?: string;
  /** A widget whose range was cut at its retention. Use `{date}`. */
  keptSince?: string;
  /** How old a widget's data is, from `freshness`. Use `{time}`. */
  dataAsOf?: string;
  /** A tracker block's observation count in its hover title. Use `{n}`. */
  observations?: string;
  /** A banner with nothing to report. */
  allClear?: string;
  /** The line that folds a list's rows past `limit`. Use `{n}`. */
  more?: string;
  /** An empty card while dashboard filters are set, before the link that clears them. */
  filtered?: string;
  /** What a screen reader says for a status glyph or dot, which is only coloured on screen. */
  tones?: { err?: string; warn?: string; ok?: string; info?: string };
}

/** A `timeline()` card's chrome. */
export interface TimelineLabels {
  /** The chip that shows every kind. */
  all?: string;
  today?: string;
  yesterday?: string;
  /** A day's count of one event. Use `{n}`. */
  event?: string;
  /** A day's count of several events. Use `{n}`. */
  events?: string;
  /** How many events a folded line holds. Use `{n}`. */
  folded?: string;
  /** Link to the next, older page. */
  older?: string;
  /** Link back to the newest page. */
  newest?: string;
}

/** A `heatmap()` card's chrome. */
export interface HeatmapLabels {
  /** The card's summary and accessible name. Use `{total}` and `{days}`. */
  summary?: string;
  /** A day's tooltip. Use `{date}` and `{value}`. */
  cell?: string;
  /** The legend's light end. */
  less?: string;
  /** The legend's dark end. */
  more?: string;
}

/** A `checklist()` card's chrome. */
export interface ChecklistLabels {
  /** How many required items are done. Use `{done}` and `{total}`. */
  summary?: string;
  /** The time since the previous done step. Use `{duration}`. */
  gap?: string;
  /** A done item's mark, for a screen reader. */
  done?: string;
  /** A required item not done, for a screen reader. */
  todo?: string;
  /** An optional item not done, for a screen reader. */
  optional?: string;
}
