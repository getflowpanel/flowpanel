"use client";
import type * as React from "react";
import { cn } from "../../lib/cn";

/**
 * Chrome for a filter control: the label lives *inside* the pill, divided from
 * the value. One row instead of two, and the filter row reads as a sentence
 * ("Plan: All") rather than a stack of captions floating over inputs.
 */
export interface FilterFieldProps {
  label?: string | undefined;
  /** Points the label at the control when the control is a single form element. */
  htmlFor?: string | undefined;
  /** Set when a value is applied — the pill brightens so active filters stand out. */
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Strips a control's own chrome *and* its horizontal padding, so the pill is
 * the single source of spacing. A control that keeps its own `px` stacks it on
 * top of the pill's and the gaps stop matching between filters.
 */
export const BARE_CONTROL =
  "h-11 gap-2 border-0 bg-transparent px-0 shadow-none focus:border-0 focus:ring-0 focus-visible:ring-0 hover:border-0 sm:h-8";

export function FilterField({
  label,
  htmlFor,
  active,
  children,
  className,
}: FilterFieldProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center rounded-full border bg-fp-bg-1 shadow-fp-xs transition-colors sm:h-9",
        active ? "border-fp-accent/40" : "border-fp-border-1 hover:border-fp-border-2",
        "focus-within:border-fp-focus focus-within:ring-2 focus-within:ring-fp-focus/25",
        className,
      )}
    >
      {label ? (
        <>
          <label
            htmlFor={htmlFor}
            className="cursor-default whitespace-nowrap pl-3 pr-2.5 text-sm text-fp-text-3"
          >
            {label}
          </label>
          <span aria-hidden className="h-4 w-px shrink-0 bg-fp-border-1" />
        </>
      ) : null}
      {/* The one place horizontal padding is set, so every pill measures the
          same from divider to value and from value to edge. */}
      <div className="flex min-w-0 items-center gap-2 pl-2.5 pr-3">{children}</div>
    </div>
  );
}
