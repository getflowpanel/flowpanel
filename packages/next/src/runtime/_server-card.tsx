import type { ReactNode } from "react";
import { cn } from "../utils/cn.js";

/** Server-only mirror of `@flowpanel/react`'s `Card` shell. */
export interface ServerCardProps {
  children: ReactNode;
  className?: string;
}

export function ServerCard({ children, className }: ServerCardProps) {
  return (
    <div className={cn("rounded-fp border border-fp-border-1 bg-fp-bg-1", className)}>
      <div className="p-4">{children}</div>
    </div>
  );
}
