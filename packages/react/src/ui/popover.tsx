"use client";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
  >(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-flowpanel-portal=""
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "fp-anim-pop fp-anim-no-exit fp-z-50 fp-w-72 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-4 fp-text-ink fp-shadow-md fp-outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )),
  PopoverPrimitive.Content,
);

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
