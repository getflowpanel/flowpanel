"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

export type DrawerWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const WIDTH_CLASS: Record<DrawerWidth, string> = {
  sm: "w-[360px]",
  md: "w-[480px]",
  lg: "w-[640px]",
  xl: "w-[820px]",
  "2xl": "w-[960px]",
  full: "w-[min(100vw,1200px)]",
};

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: DrawerWidth;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Side-variant drawer built on Radix Dialog. Radix provides focus-trap,
 * ESC handling, overlay-click-to-close, and scroll lock out of the box.
 * Animations honor `prefers-reduced-motion` via `--fp-duration` in admin.css.
 */
export function Drawer({
  open,
  onOpenChange,
  width = "lg",
  title,
  description,
  children,
  className,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-[fp-fade-in_var(--fp-duration)_var(--fp-ease-out)]",
            "data-[state=closed]:animate-[fp-fade-out_var(--fp-duration)_var(--fp-ease-out)]",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-dvh max-w-full flex-col border-l border-fp-border-1 bg-fp-bg-1 shadow-xl",
            WIDTH_CLASS[width],
            "data-[state=open]:animate-[fp-slide-in-right_var(--fp-duration)_var(--fp-ease-out)]",
            "data-[state=closed]:animate-[fp-slide-out-right_var(--fp-duration)_var(--fp-ease-out)]",
            "focus:outline-none",
            className,
          )}
        >
          {/* Radix requires a Title for a11y; hide visually when no header is
              provided so the drawer still has an accessible name. */}
          {title ? (
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          ) : (
            <DialogPrimitive.Title className="sr-only">Drawer</DialogPrimitive.Title>
          )}
          <DialogPrimitive.Description className="sr-only">
            {description ?? "Side drawer"}
          </DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close
            aria-label="Close drawer"
            className="absolute right-4 top-4 rounded-fp-sm p-1 text-fp-text-2 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-fp-accent focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DrawerHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-fp-border-1 px-6 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DrawerContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function DrawerFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-fp-border-1 px-6 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
