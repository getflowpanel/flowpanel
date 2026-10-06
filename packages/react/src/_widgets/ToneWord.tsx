import type { Tone } from "@flowpanel/core";
import { useLabels } from "../_provider/LabelsContext";

/** The word a screen reader says for a tone shown only as colour or a glyph. */
export function ToneWord({ tone }: { tone: Tone | undefined }) {
  const { tones } = useLabels().widget;
  const word = tone && Object.hasOwn(tones, tone) ? tones[tone as keyof typeof tones] : undefined;
  return word ? <span className="sr-only">{word} </span> : null;
}
