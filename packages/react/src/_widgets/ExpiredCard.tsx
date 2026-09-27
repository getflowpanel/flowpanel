import type { WidgetCaption } from "@flowpanel/core";
import { Card, CardContent } from "../_layout/Card";
import { CardHeading } from "./CardHeading";

export interface ExpiredCardProps {
  label?: string;
  caption: WidgetCaption;
  /** Drop the card frame, for a cell of a `StatStrip`. */
  plain?: boolean;
}

/** A widget whose whole range is older than its data is kept: a dash, and why. */
export function ExpiredCard({ label, caption, plain }: ExpiredCardProps) {
  const body = (
    <>
      <CardHeading label={label} caption={caption} />
      <CardContent className="pt-0 text-xl font-semibold text-fp-text-3">—</CardContent>
    </>
  );
  return plain ? (
    <div className="h-full w-full bg-fp-bg-1" data-fp-expired="" data-plain="">
      {body}
    </div>
  ) : (
    <Card className="h-full" data-fp-expired="">
      {body}
    </Card>
  );
}
