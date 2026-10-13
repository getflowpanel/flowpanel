"use client";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuSubTrigger = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }
  >(({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "fp-flex fp-cursor-default fp-select-none fp-items-center fp-gap-2 fp-rounded-sm fp-px-2 fp-py-1.5 fp-text-sm fp-outline-none fp-transition-colors focus:fp-bg-fill/70 data-[state=open]:fp-bg-fill/70",
        inset && "fp-pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="fp-ml-auto fp-h-4 fp-w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )),
  DropdownMenuPrimitive.SubTrigger,
);

const DropdownMenuSubContent = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
  >(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
      data-flowpanel-portal=""
      ref={ref}
      className={cn(
        "fp-anim-pop fp-z-50 fp-min-w-[8rem] fp-overflow-hidden fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-1 fp-text-ink fp-shadow-md",
        className,
      )}
      {...props}
    />
  )),
  DropdownMenuPrimitive.SubContent,
);

const DropdownMenuContent = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
  >(({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-flowpanel-portal=""
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "fp-anim-pop fp-z-50 fp-min-w-[8rem] fp-overflow-hidden fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-1 fp-text-ink fp-shadow-md",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )),
  DropdownMenuPrimitive.Content,
);

const DropdownMenuItem = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
  >(({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "fp-relative fp-flex fp-cursor-default fp-select-none fp-items-center fp-gap-2 fp-rounded-sm fp-px-2 fp-py-1.5 fp-text-sm fp-outline-none fp-transition-colors focus:fp-bg-fill/70 data-[disabled]:fp-pointer-events-none data-[disabled]:fp-opacity-50",
        inset && "fp-pl-8",
        className,
      )}
      {...props}
    />
  )),
  DropdownMenuPrimitive.Item,
);

const DropdownMenuCheckboxItem = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
  >(({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        "fp-relative fp-flex fp-cursor-default fp-select-none fp-items-center fp-rounded-sm fp-py-1.5 fp-pl-8 fp-pr-2 fp-text-sm fp-outline-none fp-transition-colors focus:fp-bg-fill/70 data-[disabled]:fp-pointer-events-none data-[disabled]:fp-opacity-50",
        className,
      )}
      {...props}
    >
      <span className="fp-absolute fp-left-2 fp-flex fp-h-3.5 fp-w-3.5 fp-items-center fp-justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="fp-h-4 fp-w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )),
  DropdownMenuPrimitive.CheckboxItem,
);

const DropdownMenuLabel = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Label>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
  >(({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "fp-px-2 fp-py-1.5 fp-text-sm fp-font-semibold fp-text-ink",
        inset && "fp-pl-8",
        className,
      )}
      {...props}
    />
  )),
  DropdownMenuPrimitive.Label,
);

const DropdownMenuSeparator = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
  >(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("-fp-mx-1 fp-my-1 fp-h-px fp-bg-line", className)}
      {...props}
    />
  )),
  DropdownMenuPrimitive.Separator,
);

function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("fp-ml-auto fp-text-xs fp-tracking-widest fp-text-faint", className)}
      {...props}
    />
  );
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
