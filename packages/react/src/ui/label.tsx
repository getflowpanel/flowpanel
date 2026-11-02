"use client";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

export const Label = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
  >(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "fp-text-sm fp-font-medium fp-text-ink fp-leading-none peer-disabled:fp-opacity-70",
        className,
      )}
      {...props}
    />
  )),
  LabelPrimitive.Root,
);
