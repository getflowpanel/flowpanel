import type { WidgetCaption } from "@flowpanel/core";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import { CardHeading } from "./CardHeading";
import { FIGURE } from "./figure";

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
      <CardContent className={cn("pt-0 text-fp-text-3", plain ? FIGURE : "text-xl font-semibold")}>
        —
      </CardContent>
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
