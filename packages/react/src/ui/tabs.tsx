"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../lib/cn";
import { named } from "../lib/named";

const Tabs = TabsPrimitive.Root;

const TabsList = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "fp-inline-flex fp-items-center fp-justify-center fp-rounded-lg fp-bg-fill/70 fp-p-1 fp-text-soft sm:fp-h-9",
        className,
      )}
      {...props}
    />
  )),
  TabsPrimitive.List,
);

const TabsTrigger = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "fp-inline-flex fp-min-h-11 fp-items-center fp-justify-center fp-whitespace-nowrap fp-rounded fp-px-3 fp-py-1 fp-text-sm sm:fp-min-h-0 fp-font-medium fp-transition-all hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 disabled:fp-pointer-events-none disabled:fp-opacity-50 data-[state=active]:fp-bg-surface data-[state=active]:fp-text-ink data-[state=active]:fp-shadow-sm",
        className,
      )}
      {...props}
    />
  )),
  TabsPrimitive.Trigger,
);

const TabsContent = /* @__PURE__ */ named(
  /* @__PURE__ */ React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
  >(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "fp-mt-2 focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
        className,
      )}
      {...props}
    />
  )),
  TabsPrimitive.Content,
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
