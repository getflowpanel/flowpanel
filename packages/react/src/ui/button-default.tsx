"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

export const buttonVariants = cva(
  "fp-press fp-inline-flex fp-items-center fp-justify-center fp-gap-2 fp-whitespace-nowrap fp-rounded fp-text-sm fp-font-medium focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 focus-visible:fp-ring-offset-1 focus-visible:fp-ring-offset-surface disabled:fp-pointer-events-none disabled:fp-opacity-50",
  {
    variants: {
      variant: {
        default: "fp-bg-accent fp-text-on-accent fp-shadow-xs hover:fp-bg-accent/85",
        // Solid destructive rides the AA-strength err tone; bg-1 flips with the scheme so the label stays readable.
        destructive: "fp-bg-err-ink fp-text-surface fp-shadow-xs hover:fp-bg-err-ink/85",
        outline:
          "fp-border fp-border-line-strong fp-bg-surface fp-text-ink fp-shadow-xs hover:fp-bg-canvas hover:fp-border-line-strong",
        ghost: "fp-text-ink hover:fp-bg-fill/70",
        link: "fp-text-accent fp-underline-offset-4 hover:fp-underline",
      },
      size: {
        default: "fp-h-11 fp-px-4 fp-py-2 sm:fp-h-9",
        sm: "fp-h-11 fp-px-3 sm:fp-h-8",
        lg: "fp-h-12 fp-rounded fp-px-6 sm:fp-h-10",
        icon: "fp-h-11 fp-w-11 sm:fp-h-9 sm:fp-w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** Pure renderer — no context dependency. Used as the registry default. */
export const DefaultButton = /* @__PURE__ */ named(
  /* @__PURE__ */ forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild, ...props }, ref) => {
      const Comp = asChild ? Slot : "button";
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          data-variant={variant ?? "default"}
          data-size={size ?? "default"}
          ref={ref}
          {...props}
        />
      );
    },
  ),
  "DefaultButton",
);
