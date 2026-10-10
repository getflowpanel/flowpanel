"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

/** A control the user may see but not change: muted, with no hover, focus ring or caret. */
export const READ_ONLY_CLASS =
  "aria-readonly:fp-cursor-default aria-readonly:fp-bg-canvas aria-readonly:fp-text-soft aria-readonly:fp-caret-transparent aria-readonly:fp-shadow-none aria-readonly:hover:fp-border-line aria-readonly:focus-visible:fp-border-line aria-readonly:focus-visible:fp-ring-0";

export const Input = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type = "text", ...props }, ref) => (
      <input
        ref={ref}
        type={type}
        className={cn(
          "fp-flex fp-h-9 fp-w-full fp-rounded fp-border fp-border-line fp-bg-surface fp-px-3 fp-py-1 fp-text-sm fp-text-ink fp-shadow-xs fp-transition-colors hover:fp-border-line-strong",
          "placeholder:fp-text-faint focus-visible:fp-outline-none focus-visible:fp-border-focus focus-visible:fp-ring-2 focus-visible:fp-ring-focus/25 focus-visible:hover:fp-border-focus",
          "disabled:fp-cursor-not-allowed disabled:fp-opacity-50",
          READ_ONLY_CLASS,
          className,
        )}
        {...props}
      />
    ),
  ),
  "Input",
);
