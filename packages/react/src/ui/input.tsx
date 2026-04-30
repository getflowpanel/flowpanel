"use client";
import * as React from "react";
import { cn } from "../lib/cn.js";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-9 w-full rounded-fp-sm border border-fp-border-1 bg-fp-bg-1 px-3 py-1 text-sm text-fp-text-1 shadow-sm transition-colors",
      "placeholder:text-fp-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
