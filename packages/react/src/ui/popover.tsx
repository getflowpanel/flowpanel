"use client";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { DeferredTrigger, deferredModule, useDeferredRoot } from "./deferred";
import type * as Parts from "./popover-parts";

const popovers = deferredModule(() => import("./popover-parts"));

/** Loads the popovers' code now, as a test setup does. */
export const preloadPopovers = () => popovers.ensure();

function Popover(props: React.ComponentProps<typeof Parts.Popover>) {
  const { loaded, defaultOpen, provide } = useDeferredRoot(popovers, props);
  if (loaded) return <loaded.Popover {...props} defaultOpen={defaultOpen} />;
  return provide(props.children);
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Parts.PopoverTrigger>
>(function PopoverTrigger(props, ref) {
  const loaded = popovers.useLoaded();
  if (loaded) return <loaded.PopoverTrigger ref={ref} data-fp-trigger="" {...props} />;
  return <DeferredTrigger ref={ref} popup="dialog" opensOn="click" {...props} />;
});

const PopoverAnchor = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Parts.PopoverAnchor>
>(function PopoverAnchor(props, ref) {
  const loaded = popovers.useLoaded();
  if (loaded) return <loaded.PopoverAnchor ref={ref} {...props} />;
  const { asChild, ...rest } = props;
  const Comp = asChild ? Slot : "div";
  return <Comp ref={ref} {...rest} />;
});

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Parts.PopoverContent>
>(function PopoverContent(props, ref) {
  const loaded = popovers.useLoaded();
  return loaded ? <loaded.PopoverContent ref={ref} {...props} /> : null;
});

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
