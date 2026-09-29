/** Which direction is good news: a rise for `"up"`, a fall for `"down"`. */
export type GoodWhen = "up" | "down";

/** Where a number turns bad, declared once for metrics, stats, bars, trackers and cells. */
export interface Threshold {
  /** The value at which it is a warning. */
  warn: number;
  /** The value at which it is an error. */
  err: number;
  /**
   * Which direction is good. Left out, the numbers say: `warn` below `err` means higher is worse,
   * as for an error rate; `warn` above `err` means lower is worse, as for a success rate. Given,
   * it must agree with them, or `defineAdmin` throws.
   */
  goodWhen?: GoodWhen;
  /** Below this many observations the value is `muted`: too few to judge. */
  min?: number;
}
