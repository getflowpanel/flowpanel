import type * as React from "react";
import { cn } from "../lib/cn.js";

export interface MetricGridProps {
  columns?: 1 | 2 | 3 | 4 | 6;
  className?: string;
  children: React.ReactNode;
}

const colClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};

export function MetricGrid({ columns = 4, className, children }: MetricGridProps) {
  return (
    <div className={cn("grid gap-3", colClass[columns] ?? "grid-cols-1", className)}>
      {children}
    </div>
  );
}
