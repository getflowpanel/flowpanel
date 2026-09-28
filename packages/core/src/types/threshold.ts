/** Where a number turns bad, declared once for metrics, stats, bars, trackers and cells. */
export interface Threshold {
  /** The value at which it is a warning. */
  warn: number;
  /** The value at which it is an error. */
  err: number;
  /**
   * `"down"`: lower is better, so at or above `warn` is bad, as for an error rate. `"up"`:
   * higher is better, so at or below `warn` is bad, as for a success rate.
   * @defaultValue "down"
   */
  goodWhen?: "up" | "down";
  /** Below this many observations the value is `muted`: too few to judge. */
  min?: number;
}
