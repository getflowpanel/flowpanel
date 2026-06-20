"use client";
import Link from "next/link";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/** Renders a foreign-key cell as a navigable link to the target resource's detail page. */
export interface ReferenceCellProps {
  label: React.ReactNode;
  href: string;
  className?: string;
}

export function ReferenceCell({ label, href, className }: ReferenceCellProps) {
  return (
    <Link
      href={href}
      className={cn(
        "text-fp-text-1 underline decoration-fp-border-2 underline-offset-2 hover:decoration-fp-text-3",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}
