"use client";
import Link, { useLinkStatus } from "next/link";
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
        "-fp-my-0.5 fp-inline-block fp-max-w-full fp-truncate fp-py-0.5 fp-align-bottom fp-text-ink fp-underline fp-decoration-line fp-underline-offset-2 hover:fp-decoration-faint",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Opening>{label}</Opening>
    </Link>
  );
}

/** Dims the link while the record it opens is on its way, so a click shows it was heard. */
function Opening({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "fp-animate-pulse fp-opacity-60" : undefined}>{children}</span>;
}
