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
  1: "md:fp-grid-cols-1",
  2: "md:fp-grid-cols-2",
  3: "md:fp-grid-cols-3",
  4: "md:fp-grid-cols-4",
  5: "md:fp-grid-cols-5",
  6: "md:fp-grid-cols-6",
};

/** Numbers as one band divided by hairlines, with no card around each — a KPI strip. */
export function StatStrip({ label, description, columns, className, children }: StatStripProps) {
  const cells = Math.min(Math.max(Children.toArray(children).length, 1), 6);
  return (
    <section className={cn("fp-space-y-3", className)} data-strip="">
      {label ? (
        <SectionLabel label={label} {...(description ? { description } : {})} />
      ) : description ? (
        <p className="fp-text-xs fp-text-faint">{description}</p>
      ) : null}
      <div
        className={cn(
          "fp-grid fp-grid-cols-2 fp-gap-px fp-overflow-hidden fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-shadow-xs",
          MD_COLUMNS[columns ?? cells],
          "[&>*]:fp-min-w-0 [&>*]:fp-bg-surface [&>*]:fp-shadow-[0_0_0_1px_hsl(var(--fp-border-1))]",
          "[&>*:last-child:nth-child(odd)]:fp-col-span-2 md:[&>*:last-child:nth-child(odd)]:fp-col-span-1",
        )}
      >
        {children}
      </div>
    </section>
  );
}
