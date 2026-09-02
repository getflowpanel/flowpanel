"use client";
import * as React from "react";
import { cn } from "../lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-9 w-full rounded-fp border border-fp-border-1 bg-fp-bg-1 px-3 py-1 text-sm text-fp-text-1 shadow-fp-xs transition-colors hover:border-fp-border-2",
      "placeholder:text-fp-text-3 focus-visible:outline-none focus-visible:border-fp-focus focus-visible:ring-2 focus-visible:ring-fp-focus/25 focus-visible:hover:border-fp-focus",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
