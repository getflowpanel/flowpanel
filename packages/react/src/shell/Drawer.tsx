"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { useReturnFocus } from "../lib/return-focus";
import { useLabels } from "../provider/LabelsContext";

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
  /** The dialog's name for screen readers when it shows no `DrawerTitle`; defaults to `labels.drawer.title`. */
  title?: string;
  description?: string;
  /** Where focus goes on close when the element that opened the drawer is gone. */
  returnFocus?: () => HTMLElement | null | undefined;
  children?: React.ReactNode;
  className?: string;
}

/** A mounted `DrawerTitle` names the dialog, so the drawer drops its hidden fallback name. */
const DrawerTitleSlot = React.createContext<((shown: boolean) => void) | null>(null);

/** Side-variant drawer built on Radix Dialog. */
export function Drawer({
  open,
  onOpenChange,
  width = "lg",
  title,
  description,
  returnFocus,
  children,
  className,
}: DrawerProps) {
  const labels = useLabels();
  const focus = useReturnFocus(returnFocus);
  const [titled, setTitled] = React.useState(false);
  return (
    <DrawerTitleSlot.Provider value={setTitled}>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-flowpanel-portal=""
            className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/70"
          />
          <DialogPrimitive.Content
            data-flowpanel-portal=""
            {...(description ? {} : { "aria-describedby": undefined })}
            onOpenAutoFocus={(event) => {
              focus.remember();
              event.preventDefault();
              if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
            }}
            onCloseAutoFocus={focus.restore}
            className={cn(
              "fp-anim-sheet-right fp-fixed fp-right-0 fp-top-0 fp-z-50 fp-flex fp-h-dvh fp-max-w-full fp-flex-col fp-border-l fp-border-line fp-bg-surface fp-shadow-lg",
              WIDTH_CLASS[width],
              "focus:fp-outline-none",
              className,
            )}
          >
            {titled ? null : (
              <DialogPrimitive.Title className="fp-sr-only">
                {title ?? labels.drawer.title}
              </DialogPrimitive.Title>
            )}
            {description ? (
              <DialogPrimitive.Description className="fp-sr-only">
                {description}
              </DialogPrimitive.Description>
            ) : null}
            {children}
            <DialogPrimitive.Close
              aria-label={labels.drawer.close}
              className="fp-absolute fp-right-2 fp-top-2 fp-inline-flex fp-h-11 fp-w-11 fp-items-center fp-justify-center fp-rounded-sm fp-text-faint fp-transition-colors hover:fp-bg-fill/70 hover:fp-text-ink focus:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 sm:fp-right-3 sm:fp-top-3 sm:fp-h-9 sm:fp-w-9"
            >
              <X aria-hidden className="fp-h-4 fp-w-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </DrawerTitleSlot.Provider>
  );
}

/** The drawer's visible heading, which also names the dialog. */
export function DrawerTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  const register = React.useContext(DrawerTitleSlot);
  React.useLayoutEffect(() => {
    register?.(true);
    return () => register?.(false);
  }, [register]);
  return (
    <DialogPrimitive.Title
      className={cn("fp-truncate fp-text-lg fp-font-semibold fp-text-ink", className)}
      {...props}
    />
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
