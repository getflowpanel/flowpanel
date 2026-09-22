import type { ReactNode } from "react";
import { cn } from "../utils/cn";

/** Server-only mirror of `@flowpanel/react`'s `Card` shell. */
export interface ServerCardProps {
  children: ReactNode;
  className?: string;
  /** Marks the card as a FlowPanel error surface, which smoke tests look for. */
  "data-fp-error"?: "";
}

export function ServerCard({ children, className, ...rest }: ServerCardProps) {
  return (
    <div {...rest} className={cn("rounded-fp border border-fp-border-1 bg-fp-bg-1", className)}>
      <div className="p-4">{children}</div>
    </div>
  );
}
