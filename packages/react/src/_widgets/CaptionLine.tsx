import type { WidgetCaption } from "@flowpanel/core";
import { cn } from "../lib/cn";
import { toneTextClass } from "../lib/tone-classes";
import { ToneWord } from "./ToneWord";

export interface CaptionLineProps {
  caption?: WidgetCaption | undefined;
}

/** The small line under a card title: where its range was cut, how fresh it is, or its coverage. */
export function CaptionLine({ caption }: CaptionLineProps) {
  if (!caption) return null;
  const alarming = caption.tone === "warn" || caption.tone === "err";
  return (
    <span
      data-fp-caption={caption.tone ?? ""}
      title={caption.title}
      className={cn(
        "mt-0.5 block text-xs font-normal",
        alarming && caption.tone ? toneTextClass[caption.tone] : "text-fp-text-3",
      )}
    >
      {alarming ? <span aria-hidden>{caption.tone === "err" ? "✕ " : "▲ "}</span> : null}
      {alarming ? <ToneWord tone={caption.tone} /> : null}
      {caption.text}
    </span>
  );
}
