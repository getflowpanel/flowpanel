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
      <h2 className="text-base font-medium text-fp-text-1">{label}</h2>
      {description ? <p className="text-xs text-fp-text-3 mt-0.5">{description}</p> : null}
    </div>
  );
}

export interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return <hr className={cn("my-4 border-fp-border-1", className)} />;
}

export interface SectionProps {
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  className?: string;
  children: React.ReactNode;
}

const colClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  12: "grid-cols-12",
};

export const spanClass: Record<Span, string> = {
  1: "col-span-12 sm:col-span-1",
  2: "col-span-12 sm:col-span-2",
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  6: "col-span-12 sm:col-span-6",
  8: "col-span-12 sm:col-span-8",
  12: "col-span-12",
};

export function Section({ label, description, columns = 1, className, children }: SectionProps) {
  return (
    <section className={cn("space-y-3", className)} data-columns={columns}>
      {label ? (
        <SectionLabel label={label} {...(description ? { description } : {})} />
      ) : description ? (
        <p className="text-xs text-fp-text-3">{description}</p>
      ) : null}
      <div className={cn("grid gap-3", colClass[columns] ?? "grid-cols-1")}>{children}</div>
    </section>
  );
}
