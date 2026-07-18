"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn.js";

export const buttonVariants = cva(
  "fp-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-fp text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 focus-visible:ring-offset-1 focus-visible:ring-offset-fp-bg-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-fp-accent text-fp-accent-text shadow-fp-xs hover:bg-fp-accent/85",
        // Solid destructive rides the AA-strength err tone; bg-1 flips with the
        // scheme, so the label stays readable on both.
        destructive: "bg-fp-err-text text-fp-bg-1 shadow-fp-xs hover:bg-fp-err-text/85",
        outline:
          "border border-fp-border-2 bg-fp-bg-1 text-fp-text-1 shadow-fp-xs hover:bg-fp-bg-2 hover:border-fp-border-2",
        ghost: "text-fp-text-1 hover:bg-fp-bg-3/70",
        link: "text-fp-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-fp-sm px-3",
        lg: "h-10 rounded-fp px-6",
        icon: "h-9 w-9",
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
export const DefaultButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
DefaultButton.displayName = "DefaultButton";
