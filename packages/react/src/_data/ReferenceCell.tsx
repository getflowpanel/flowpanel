"use client";
import Link from "next/link";
import type * as React from "react";
import { cn } from "../lib/cn";

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
        "fp-text-ink fp-underline fp-decoration-line-strong fp-underline-offset-2 hover:fp-decoration-faint",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}
