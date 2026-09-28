import type { WidgetCaption } from "@flowpanel/core";
import { CaptionLine } from "@flowpanel/react";
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
    <div {...rest} className={cn("rounded-fp border border-fp-border-1 bg-fp-bg-1", className)}>
      {heading ? (
        <div className="px-4 pt-4 pb-2 text-sm font-medium text-fp-text-1">
          {caption ? (
            <>
              {label}
              <CaptionLine caption={caption} />
            </>
          ) : (
            label
          )}
        </div>
      ) : null}
      <div className={heading ? "px-4 pb-4" : "p-4"}>{children}</div>
    </div>
  );
}
