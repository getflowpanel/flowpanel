import { Children, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { SectionLabel } from "./Section";

export interface StatStripProps {
  label?: string;
  description?: string;
  /** Cells per line from `md` up; two per line below. Default: the number of cells, at most six. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: ReactNode;
}

const MD_COLUMNS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

/** Numbers as one band divided by hairlines, with no card around each — a KPI strip. */
export function StatStrip({ label, description, columns, className, children }: StatStripProps) {
  const cells = Math.min(Math.max(Children.count(children), 1), 6);
  return (
    <section className={cn("space-y-3", className)} data-strip="">
      {label ? (
        <SectionLabel label={label} {...(description ? { description } : {})} />
      ) : description ? (
        <p className="text-xs text-fp-text-3">{description}</p>
      ) : null}
      <div
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 shadow-fp-xs",
          MD_COLUMNS[columns ?? cells],
          "[&>*]:min-w-0 [&>*]:bg-fp-bg-1 [&>*]:shadow-[0_0_0_1px_hsl(var(--fp-border-1))]",
          "[&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1",
        )}
      >
        {children}
      </div>
    </section>
  );
}
