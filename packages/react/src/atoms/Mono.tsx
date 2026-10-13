import type * as React from "react";
import { cn } from "../lib/cn";

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("fp-font-mono fp-text-xs", className)}>{children}</span>;
}
