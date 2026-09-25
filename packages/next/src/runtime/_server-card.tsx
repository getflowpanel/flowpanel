import type { ReactNode } from "react";
import { cn } from "../utils/cn";

/** Server-only mirror of `@flowpanel/react`'s `Card` shell. */
export interface ServerCardProps {
  children: ReactNode;
  className?: string;
  /** Card title above the content, as `CardHeader` renders it. */
  label?: string;
  /** Marks the card as a FlowPanel error surface, which smoke tests look for. */
  "data-fp-error"?: "";
}

export function ServerCard({ children, className, label, ...rest }: ServerCardProps) {
  return (
    <div {...rest} className={cn("rounded-fp border border-fp-border-1 bg-fp-bg-1", className)}>
      {label ? (
        <div className="px-4 pt-4 pb-2 text-sm font-medium text-fp-text-1">{label}</div>
      ) : null}
      <div className={label ? "px-4 pb-4" : "p-4"}>{children}</div>
    </div>
  );
}
