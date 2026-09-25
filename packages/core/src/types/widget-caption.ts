import type { Tone } from "./widget";
import type { WidgetContext } from "./widget-context";

/** How old a widget's data is, read from wherever it was last written. */
export interface Freshness {
  /** When the data was last written, e.g. the newest rollup row; `null` when unknown. */
  at: (ctx: WidgetContext) => Promise<Date | null>;
  /** Older than this shows in the warn tone with a ▲. */
  warnAfter?: `${number}m` | `${number}h` | `${number}d`;
}

/** The caption options every widget takes beside `maxRange`. */
export interface CaptionOptions {
  /** Say under the title how old the data is. */
  freshness?: Freshness;
  /** Say under the title that the data is a sample, e.g. "users who accepted analytics". */
  coverage?: string;
}

/** The one line under a card's title, computed on the server. */
export interface WidgetCaption {
  text: string;
  /** `warn` for stale data. */
  tone?: Tone;
  /** Hover text. */
  title?: string;
}
