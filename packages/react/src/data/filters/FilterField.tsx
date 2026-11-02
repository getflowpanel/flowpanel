"use client";
import type * as React from "react";
import { cn } from "../../lib/cn";

/** Chrome for a filter control: the label lives *inside* the pill, so the row reads as a sentence ("Plan: All"). */
export interface FilterFieldProps {
  label?: string | undefined;
  /** Points the label at the control when the control is a single form element. */
  htmlFor?: string | undefined;
  /** Set when a value is applied — the pill brightens so active filters stand out. */
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Strips a control's own chrome and horizontal padding, so the pill is the single source of spacing. */
export const BARE_CONTROL =
  "fp-h-11 fp-gap-2 fp-border-0 fp-bg-transparent fp-px-0 fp-shadow-none focus:fp-border-0 focus:fp-ring-0 focus-visible:fp-ring-0 hover:fp-border-0 sm:fp-h-8";

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
        "fp-inline-flex fp-h-11 fp-items-center fp-rounded-full fp-border fp-bg-surface fp-shadow-xs fp-transition-colors sm:fp-h-9",
        active ? "fp-border-accent/40" : "fp-border-line hover:fp-border-line-strong",
        "focus-within:fp-border-focus focus-within:fp-ring-2 focus-within:fp-ring-focus/25",
        className,
      )}
    >
      {label ? (
        <>
          <label
            htmlFor={htmlFor}
            className="fp-cursor-default fp-whitespace-nowrap fp-pl-3 fp-pr-2.5 fp-text-sm fp-text-faint"
          >
            {label}
          </label>
          <span aria-hidden className="fp-h-4 fp-w-px fp-shrink-0 fp-bg-line" />
        </>
      ) : null}
      {/* The one place horizontal padding is set, so every pill measures the
          same from divider to value and from value to edge. */}
      <div className="fp-flex fp-min-w-0 fp-items-center fp-gap-2 fp-pl-2.5 fp-pr-3">
        {children}
      </div>
    </div>
  );
}
