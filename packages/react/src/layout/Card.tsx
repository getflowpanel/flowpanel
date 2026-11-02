import type * as React from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...p}
      className={cn("fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-shadow-xs", className)}
    />
  );
}

export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cn("fp-px-4 fp-pt-4 fp-pb-2 fp-text-sm fp-text-soft", className)} />
  );
}

export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("fp-p-4", className)} />;
}

export function CardDescription({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("fp-px-4 fp-text-xs fp-text-faint", className)} />;
}
