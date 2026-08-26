import type * as React from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fp-skeleton rounded-fp-sm", className)} {...props} />;
}
