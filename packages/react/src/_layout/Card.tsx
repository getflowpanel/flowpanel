import * as React from "react";
import { cn } from "../lib/cn.js";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cn("rounded-fp border border-fp-border-1 bg-fp-bg-1", className)} />
  );
}

export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cn("px-4 pt-4 pb-2 text-sm font-medium text-fp-text-1", className)} />
  );
}

export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("p-4", className)} />;
}

export function CardDescription({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("px-4 text-xs text-fp-text-3", className)} />;
}
