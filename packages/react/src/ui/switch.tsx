"use client";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

export const Switch = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
  >(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
      ref={ref}
      className={cn(
        "fp-peer fp-inline-flex fp-h-5 fp-w-9 fp-shrink-0 fp-cursor-pointer fp-items-center fp-rounded-full fp-border-2 fp-border-transparent fp-transition-colors focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 focus-visible:fp-ring-offset-2 focus-visible:fp-ring-offset-surface disabled:fp-cursor-not-allowed disabled:fp-opacity-50 data-[state=checked]:fp-bg-accent data-[state=unchecked]:fp-bg-line-strong data-[state=unchecked]:hover:fp-bg-faint/50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "fp-pointer-events-none fp-block fp-h-4 fp-w-4 fp-rounded-full fp-bg-white fp-shadow-sm fp-ring-0 fp-transition-transform fp-duration-150 fp-ease-out data-[state=checked]:fp-translate-x-4 data-[state=unchecked]:fp-translate-x-0",
        )}
      />
    </SwitchPrimitives.Root>
  )),
  SwitchPrimitives.Root,
);
