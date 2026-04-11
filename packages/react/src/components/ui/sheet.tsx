import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";
import { useFlowPanelContainer } from "../../context";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

const SheetOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fp:fixed fp:inset-0 fp:z-50 fp:bg-black/50 fp:data-[state=open]:animate-in fp:data-[state=closed]:animate-out fp:data-[state=closed]:fade-out-0 fp:data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

export const SheetContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const container = useFlowPanelContainer();

  return (
    <DialogPrimitive.Portal container={container ?? undefined}>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fp:fixed fp:inset-y-0 fp:right-0 fp:z-50 fp:flex fp:w-[420px] fp:flex-col fp:bg-background fp:shadow-lg fp:transition-transform fp:duration-300 fp:data-[state=open]:animate-in fp:data-[state=closed]:animate-out fp:data-[state=closed]:slide-out-to-right fp:data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="fp:absolute fp:right-4 fp:top-4 fp:rounded-sm fp:opacity-70 fp:transition-opacity fp:hover:opacity-100 fp:focus:outline-none fp:disabled:pointer-events-none">
          <X className="fp:h-4 fp:w-4" />
          <span className="fp:sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
SheetContent.displayName = "SheetContent";

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("fp:flex fp:flex-col fp:gap-1.5 fp:px-6 fp:py-4", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

export const SheetTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("fp:text-lg fp:font-semibold fp:text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

export const SheetClose = DialogPrimitive.Close;
