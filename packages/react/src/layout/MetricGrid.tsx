import type * as React from "react";
import { cn } from "../lib/cn";

export interface MetricGridProps {
  columns?: 1 | 2 | 3 | 4 | 6;
  className?: string;
  children: React.ReactNode;
}

const colClass: Record<number, string> = {
  1: "fp-grid-cols-1",
  2: "fp-grid-cols-1 md:fp-grid-cols-2",
  3: "fp-grid-cols-1 md:fp-grid-cols-2 lg:fp-grid-cols-3",
  4: "fp-grid-cols-2 md:fp-grid-cols-4",
  6: "fp-grid-cols-2 md:fp-grid-cols-3 lg:fp-grid-cols-6",
};

export function MetricGrid({ columns = 4, className, children }: MetricGridProps) {
  return (
    <div className={cn("fp-grid fp-gap-3", colClass[columns] ?? "fp-grid-cols-1", className)}>
      {children}
    </div>
  );
}
