"use client";
import Link from "next/link";
import type * as React from "react";
import { cn } from "../lib/cn";

export interface ReferenceCellProps {
  label: React.ReactNode;
  href: string;
  className?: string;
}

/** Renders a foreign-key cell as a link to the target's detail page, cut to its cell so its target never runs under the next column. */
export function ReferenceCell({ label, href, className }: ReferenceCellProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "fp-inline-block fp-max-w-full fp-truncate fp-align-bottom fp-text-ink fp-underline fp-decoration-line-strong fp-underline-offset-2 hover:fp-decoration-faint",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}
