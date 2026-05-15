"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/cn.js";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-fp text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-fp-accent text-fp-accent-text hover:opacity-90",
        destructive: "bg-fp-err text-white hover:opacity-90",
        outline: "border border-fp-border-1 bg-transparent hover:bg-fp-bg-2",
        ghost: "hover:bg-fp-bg-2 text-fp-text-1",
        link: "text-fp-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-fp-sm px-3",
        lg: "h-10 rounded-fp px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** Pure renderer — no context dependency. Used as the registry default. */
export const DefaultButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
DefaultButton.displayName = "DefaultButton";
