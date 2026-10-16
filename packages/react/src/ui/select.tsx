"use client";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";
import { INVALID_CLASS } from "./input";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
  >(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "fp-flex fp-h-9 fp-w-full fp-items-center fp-justify-between fp-gap-2 fp-rounded fp-border fp-border-line fp-bg-surface fp-px-3 fp-py-2 fp-text-sm fp-text-ink fp-shadow-xs fp-transition-colors hover:fp-border-line-strong placeholder:fp-text-faint focus:fp-outline-none focus:fp-border-focus focus:fp-ring-2 focus:fp-ring-focus/25 disabled:fp-cursor-not-allowed disabled:fp-opacity-50 [&>span]:fp-truncate",
        INVALID_CLASS,
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="fp-h-4 fp-w-4 fp-opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )),
  SelectPrimitive.Trigger,
);

const SelectScrollUpButton = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
  >(({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
        "fp-flex fp-cursor-default fp-items-center fp-justify-center fp-py-1",
        className,
      )}
      {...props}
    >
      <ChevronUp className="fp-h-4 fp-w-4" />
    </SelectPrimitive.ScrollUpButton>
  )),
  SelectPrimitive.ScrollUpButton,
);

const SelectScrollDownButton = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
  >(({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
        "fp-flex fp-cursor-default fp-items-center fp-justify-center fp-py-1",
        className,
      )}
      {...props}
    >
      <ChevronDown className="fp-h-4 fp-w-4" />
    </SelectPrimitive.ScrollDownButton>
  )),
  SelectPrimitive.ScrollDownButton,
);

const SelectContent = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
  >(({ className, children, position = "popper", ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-flowpanel-portal=""
        ref={ref}
        position={position}
        className={cn(
          "fp-anim-pop fp-relative fp-z-50 fp-max-h-96 fp-min-w-[8rem] fp-overflow-hidden fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-text-ink fp-shadow-md",
          position === "popper" &&
            "data-[side=bottom]:fp-translate-y-1 data-[side=left]:-fp-translate-x-1 data-[side=right]:fp-translate-x-1 data-[side=top]:-fp-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "fp-p-1",
            position === "popper" &&
              "fp-h-[var(--radix-select-trigger-height)] fp-w-full fp-min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )),
  SelectPrimitive.Content,
);

const SelectLabel = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Label>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
  >(({ className, ...props }, ref) => (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        "fp-py-1.5 fp-pl-8 fp-pr-2 fp-text-sm fp-font-semibold fp-text-soft",
        className,
      )}
      {...props}
    />
  )),
  SelectPrimitive.Label,
);

const SelectItem = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
  >(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "fp-relative fp-flex fp-w-full fp-cursor-default fp-select-none fp-items-center fp-rounded-sm fp-py-1.5 fp-pl-8 fp-pr-2 fp-text-sm fp-outline-none fp-transition-colors focus:fp-bg-fill/70 focus:fp-text-ink data-[disabled]:fp-pointer-events-none data-[disabled]:fp-opacity-50",
        className,
      )}
      {...props}
    >
      <span className="fp-absolute fp-left-2 fp-flex fp-h-3.5 fp-w-3.5 fp-items-center fp-justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="fp-h-4 fp-w-4 fp-text-accent" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )),
  SelectPrimitive.Item,
);

const SelectSeparator = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
  >(({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-fp-mx-1 fp-my-1 fp-h-px fp-bg-line", className)}
      {...props}
    />
  )),
  SelectPrimitive.Separator,
);

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
