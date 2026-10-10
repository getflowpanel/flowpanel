import type { Span } from "@flowpanel/core";
import type * as React from "react";
import { cn } from "../lib/cn";

export interface SectionLabelProps {
  label: string;
  description?: string;
  className?: string;
}

export function SectionLabel({ label, description, className }: SectionLabelProps) {
  return (
    <div className={className}>
      <h2 className="fp-text-base fp-font-semibold fp-text-ink">{label}</h2>
      {description ? <p className="fp-text-xs fp-text-faint fp-mt-0.5">{description}</p> : null}
    </div>
  );
}

export interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return <hr className={cn("fp-my-4 fp-border-line", className)} />;
}

export interface SectionProps {
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  className?: string;
  children: React.ReactNode;
}

const colClass: Record<number, string> = {
  1: "fp-grid-cols-1",
  2: "fp-grid-cols-1 md:fp-grid-cols-2",
  3: "fp-grid-cols-1 md:fp-grid-cols-2 lg:fp-grid-cols-3",
  4: "fp-grid-cols-2 md:fp-grid-cols-4",
  6: "fp-grid-cols-2 md:fp-grid-cols-3 lg:fp-grid-cols-6",
  12: "fp-grid-cols-12",
};

export const spanClass: Record<Span, string> = {
  1: "fp-col-span-12 sm:fp-col-span-1",
  2: "fp-col-span-12 sm:fp-col-span-2",
  3: "fp-col-span-12 sm:fp-col-span-3",
  4: "fp-col-span-12 sm:fp-col-span-4",
  5: "fp-col-span-12 sm:fp-col-span-5",
  6: "fp-col-span-12 sm:fp-col-span-6",
  7: "fp-col-span-12 sm:fp-col-span-7",
  8: "fp-col-span-12 sm:fp-col-span-8",
  9: "fp-col-span-12 sm:fp-col-span-9",
  10: "fp-col-span-12 sm:fp-col-span-10",
  11: "fp-col-span-12 sm:fp-col-span-11",
  12: "fp-col-span-12",
};

export function Section({ label, description, columns = 1, className, children }: SectionProps) {
  return (
    <section className={cn("fp-space-y-3", className)} data-columns={columns}>
      {label ? (
        <SectionLabel label={label} {...(description ? { description } : {})} />
      ) : description ? (
        <p className="fp-text-xs fp-text-faint">{description}</p>
      ) : null}
      <div className={cn("fp-grid fp-gap-3", colClass[columns] ?? "fp-grid-cols-1")}>
        {children}
      </div>
    </section>
  );
}
