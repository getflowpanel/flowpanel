"use client";
import { formatLabel } from "@flowpanel/core/labels";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import * as React from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";

export interface FilterSheetProps {
  /** How many filters are set, shown on the phone button. */
  active: number;
  children: React.ReactNode;
  className?: string;
}

/** Filters in line from `sm` up; on a phone, one "Filters (n)" button and a bottom sheet. */
export function FilterSheet({ active, children, className }: FilterSheetProps) {
  const { filters, drawer } = useLabels();
  const [open, setOpen] = React.useState(false);
  const phone = useMediaQuery("(max-width: 639px)");
  return (
    <>
      {phone ? null : (
        <div className={cn("fp-contents max-sm:fp-hidden", className)}>{children}</div>
      )}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger asChild>
          <Button variant="outline" className="fp-rounded-full sm:fp-hidden">
            <SlidersHorizontal aria-hidden className="fp-h-4 fp-w-4" />
            {active > 0 ? formatLabel(filters.openCount, { n: active }) : filters.open}
          </Button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-flowpanel-portal=""
            className="fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/60"
          />
          <DialogPrimitive.Content
            data-flowpanel-portal=""
            aria-describedby={undefined}
            className="fp-fixed fp-inset-x-0 fp-bottom-0 fp-z-50 fp-flex fp-max-h-[85dvh] fp-flex-col fp-rounded-t-xl fp-border-t fp-border-line fp-bg-surface fp-shadow-lg focus:fp-outline-none"
          >
            <div className="fp-flex fp-items-center fp-justify-between fp-px-4 fp-pt-2">
              <DialogPrimitive.Title className="fp-text-base fp-font-semibold fp-text-ink">
                {filters.label}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label={drawer.close}
                className="fp-inline-flex fp-h-11 fp-w-11 fp-items-center fp-justify-center fp-rounded-sm fp-text-faint hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
              >
                <X aria-hidden className="fp-h-4 fp-w-4" />
              </DialogPrimitive.Close>
            </div>
            <div className="fp-flex fp-min-h-0 fp-flex-1 fp-flex-col fp-items-stretch fp-gap-3 fp-overflow-y-auto fp-px-4 fp-py-3 [&>*]:fp-w-full">
              {phone ? children : null}
            </div>
            <div className="fp-border-t fp-border-line fp-p-4 fp-pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DialogPrimitive.Close asChild>
                <Button className="fp-w-full">{filters.done}</Button>
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
