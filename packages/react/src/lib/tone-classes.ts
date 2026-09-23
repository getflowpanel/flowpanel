import type { Tone } from "./format";

export const toneTextClass: Record<Tone, string> = {
  default: "text-fp-text-1",
  accent: "text-fp-accent-badge-text",
  ok: "text-fp-ok-text",
  warn: "text-fp-warn-text",
  err: "text-fp-err-text",
  info: "text-fp-info-text",
  muted: "text-fp-text-3",
};

export const toneFillClass: Record<Tone, string> = {
  default: "bg-fp-accent",
  accent: "bg-fp-accent",
  ok: "bg-fp-ok",
  warn: "bg-fp-warn",
  err: "bg-fp-err",
  info: "bg-fp-info",
  muted: "bg-fp-text-3",
};
