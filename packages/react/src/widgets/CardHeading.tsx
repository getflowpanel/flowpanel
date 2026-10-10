import type { WidgetCaption } from "@flowpanel/core";
import { CardHeader } from "../layout/Card";
import { CaptionLine } from "./CaptionLine";

export interface CardHeadingProps {
  label?: string | undefined;
  caption?: WidgetCaption | undefined;
}

/** A card's title and its caption; nothing when it has neither. */
export function CardHeading({ label, caption }: CardHeadingProps) {
  if (!label && !caption) return null;
  return (
    <CardHeader>
      {label}
      <CaptionLine caption={caption} />
    </CardHeader>
  );
}
