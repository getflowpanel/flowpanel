"use client";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

export const Checkbox = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
  >(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "fp-peer fp-group fp-inline-flex fp-h-11 fp-w-11 fp-shrink-0 fp-items-center fp-justify-center fp-rounded-sm fp-text-on-accent fp-transition-colors focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 focus-visible:fp-ring-offset-1 focus-visible:fp-ring-offset-surface disabled:fp-cursor-not-allowed disabled:fp-opacity-50 sm:fp-h-4 sm:fp-w-4",
        className,
      )}
      {...props}
    >
      <span className="fp-flex fp-h-4 fp-w-4 fp-shrink-0 fp-items-center fp-justify-center fp-rounded-[0.25rem] fp-border fp-border-line-strong fp-bg-surface fp-text-on-accent fp-shadow-xs fp-transition-colors group-hover:fp-border-faint group-data-[state=checked]:fp-border-accent group-data-[state=checked]:fp-bg-accent group-data-[state=indeterminate]:fp-border-accent group-data-[state=indeterminate]:fp-bg-accent">
        <CheckboxPrimitive.Indicator
          className={cn("fp-flex fp-items-center fp-justify-center fp-text-current")}
        >
          <Check
            className="fp-h-3 fp-w-3 group-data-[state=indeterminate]:fp-hidden"
            strokeWidth={3}
          />
          <Minus
            className="fp-hidden fp-h-3 fp-w-3 group-data-[state=indeterminate]:fp-block"
            strokeWidth={3}
          />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )),
  CheckboxPrimitive.Root,
);
