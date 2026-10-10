import type { Tone } from "./types/widget";

/** Text colour class per tone, for a custom widget's own markup. Server-safe. */
export const toneTextClass: Record<Tone, string> = {
  default: "fp-text-ink",
  accent: "fp-text-accent-ink",
  ok: "fp-text-ok-ink",
  warn: "fp-text-warn-ink",
  err: "fp-text-err-ink",
  info: "fp-text-info-ink",
  muted: "fp-text-faint",
};

/** Fill class per tone, for a dot, a bar or a cell. `default` is the data fill. Server-safe. */
export const toneFillClass: Record<Tone, string> = {
  default: "fp-bg-data",
  accent: "fp-bg-accent",
  ok: "fp-bg-ok",
  warn: "fp-bg-warn",
  err: "fp-bg-err",
  info: "fp-bg-info",
  muted: "fp-bg-faint",
};
