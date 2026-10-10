"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn";

export type DrawerWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const WIDTH_CLASS: Record<DrawerWidth, string> = {
  sm: "fp-w-full sm:fp-w-[360px]",
  md: "fp-w-full sm:fp-w-[480px]",
  lg: "fp-w-full sm:fp-w-[640px]",
  xl: "fp-w-full sm:fp-w-[820px]",
  "2xl": "fp-w-full sm:fp-w-[960px]",
  full: "fp-w-full sm:fp-w-[min(100vw,1200px)]",
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

/** Side-variant drawer built on Radix Dialog. */
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
          data-flowpanel-portal=""
          className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/70"
        />
        <DialogPrimitive.Content
          data-flowpanel-portal=""
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          className={cn(
            "fp-anim-sheet-right fp-fixed fp-right-0 fp-top-0 fp-z-50 fp-flex fp-h-dvh fp-max-w-full fp-flex-col fp-border-l fp-border-line fp-bg-surface fp-shadow-lg",
            WIDTH_CLASS[width],
            "focus:fp-outline-none",
            className,
          )}
        >
          {title ? (
            <DialogPrimitive.Title className="fp-sr-only">{title}</DialogPrimitive.Title>
          ) : (
            <DialogPrimitive.Title className="fp-sr-only">Drawer</DialogPrimitive.Title>
          )}
          <DialogPrimitive.Description className="fp-sr-only">
            {description ?? "Side drawer"}
          </DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close
            aria-label="Close drawer"
            className="fp-absolute fp-right-4 fp-top-4 fp-rounded-sm fp-p-1 fp-text-faint fp-transition-colors hover:fp-bg-fill/70 hover:fp-text-ink focus:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
          >
            <X className="fp-h-4 fp-w-4" />
            <span className="fp-sr-only">Close</span>
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
        "fp-flex fp-shrink-0 fp-items-start fp-justify-between fp-gap-4 fp-border-b fp-border-line fp-px-6 fp-py-4",
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
    <div
      className={cn("fp-min-h-0 fp-flex-1 fp-overflow-y-auto fp-px-6 fp-py-4", className)}
      {...props}
    >
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
        "fp-flex fp-shrink-0 fp-items-center fp-justify-end fp-gap-2 fp-border-t fp-border-line fp-px-6 fp-py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
