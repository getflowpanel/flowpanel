"use client";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-fp-sm text-fp-accent-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 focus-visible:ring-offset-1 focus-visible:ring-offset-fp-bg-1 disabled:cursor-not-allowed disabled:opacity-50 sm:h-4 sm:w-4",
      className,
    )}
    {...props}
  >
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-fp-border-2 bg-fp-bg-1 text-fp-accent-text shadow-fp-xs transition-colors group-hover:border-fp-text-3 group-data-[state=checked]:border-fp-accent group-data-[state=checked]:bg-fp-accent">
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-3 w-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
