import type { WidgetCaption } from "@flowpanel/core";
import { Card, CardContent } from "../_layout/Card";
import { CardHeading } from "./CardHeading";

export interface ExpiredCardProps {
  label?: string;
  caption: WidgetCaption;
}

/** A widget whose whole range is older than its data is kept: a dash, and why. */
export function ExpiredCard({ label, caption }: ExpiredCardProps) {
  return (
    <Card className="h-full" data-fp-expired="">
      <CardHeading label={label} caption={caption} />
      <CardContent className="pt-0 text-xl font-semibold text-fp-text-3">—</CardContent>
    </Card>
  );
}
