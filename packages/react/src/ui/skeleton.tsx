import type * as React from "react";
import { cn } from "../lib/cn.js";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-fp-sm bg-fp-bg-3", className)} {...props} />;
}
