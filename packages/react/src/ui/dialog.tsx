"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";
import { useLabels } from "../provider/LabelsContext";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
  >(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      data-flowpanel-portal=""
      ref={ref}
      className={cn("fp-anim-overlay fp-fixed fp-inset-0 fp-z-50 fp-bg-overlay/70", className)}
      {...props}
    />
  )),
  DialogPrimitive.Overlay,
);

const DialogContent = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
  >(({ className, children, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-flowpanel-portal=""
        ref={ref}
        className={cn(
          "fp-anim-dialog fp-fixed fp-left-[50%] fp-top-[50%] fp-z-50 fp-grid fp-w-full fp-max-w-lg fp-translate-x-[-50%] fp-translate-y-[-50%] fp-gap-4 fp-border fp-border-line fp-bg-surface fp-p-6 fp-shadow-lg sm:fp-rounded-xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogCloseButton />
      </DialogPrimitive.Content>
    </DialogPortal>
  )),
  DialogPrimitive.Content,
);

function DialogCloseButton() {
  const { drawer } = useLabels();
  return (
    <DialogPrimitive.Close
      aria-label={drawer.close}
      className="fp-absolute fp-right-2 fp-top-2 fp-inline-flex fp-h-11 fp-w-11 fp-items-center fp-justify-center fp-rounded-sm fp-text-faint fp-transition-colors hover:fp-bg-fill/70 hover:fp-text-ink focus:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 disabled:fp-pointer-events-none sm:fp-right-3 sm:fp-top-3 sm:fp-h-9 sm:fp-w-9"
    >
      <X aria-hidden className="fp-h-4 fp-w-4" />
    </DialogPrimitive.Close>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("fp-flex fp-flex-col fp-gap-1.5 fp-text-center sm:fp-text-left", className)}
      {...props}
    />
  );
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fp-flex fp-flex-col-reverse sm:fp-flex-row sm:fp-justify-end sm:fp-gap-2",
        className,
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

const DialogTitle = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
  >(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "fp-text-lg fp-font-semibold fp-leading-none fp-tracking-tight fp-text-ink",
        className,
      )}
      {...props}
    />
  )),
  DialogPrimitive.Title,
);

const DialogDescription = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
  >(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("fp-text-sm fp-text-faint", className)}
      {...props}
    />
  )),
  DialogPrimitive.Description,
);

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
