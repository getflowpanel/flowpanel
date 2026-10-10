import type { WidgetCaption } from "@flowpanel/core";
import { CardHeading } from "@flowpanel/react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

/** Server-only mirror of `@flowpanel/react`'s `Card` shell. */
export interface ServerCardProps {
  children: ReactNode;
  className?: string;
  /** Card title above the content, as `CardHeader` renders it. */
  label?: string;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
  /** Marks the card as a FlowPanel error surface, which smoke tests look for. */
  "data-fp-error"?: "";
}

export function ServerCard({ children, className, label, caption, ...rest }: ServerCardProps) {
  const heading = Boolean(label) || caption !== undefined;
  return (
    <div
      {...rest}
      className={cn(
        "fp-h-full fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-shadow-xs",
        className,
      )}
    >
      <CardHeading label={label} caption={caption} />
      <div className={heading ? "fp-px-4 fp-pb-4" : "fp-p-4"}>{children}</div>
    </div>
  );
}
