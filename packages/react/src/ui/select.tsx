"use client";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { DeferredTrigger, deferredModule, useDeferredRoot } from "./deferred";
import { INVALID_CLASS } from "./input";
import type * as Parts from "./select-parts";
import { SELECT_TRIGGER_CLASS } from "./select-trigger-class";

const selects = deferredModule(() => import("./select-parts"));

/** Loads the selects' code now, as a test setup does. */
export const preloadSelects = () => selects.ensure();

type PartProps<K extends keyof typeof Parts> = React.ComponentPropsWithoutRef<(typeof Parts)[K]>;

/** Until its code arrives a named select still submits its value with the form. */
function Select(props: React.ComponentProps<typeof Parts.Select>) {
  const { loaded, defaultOpen, provide } = useDeferredRoot(selects, props);
  if (loaded) return <loaded.Select {...props} defaultOpen={defaultOpen} />;
  const value = props.value ?? props.defaultValue;
  return provide(
    <>
      {props.children}
      {props.name ? <input type="hidden" name={props.name} value={value ?? ""} /> : null}
    </>,
  );
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, PartProps<"SelectTrigger">>(
  function SelectTrigger({ className, children, ...props }, ref) {
    const loaded = selects.useLoaded();
    if (loaded) {
      return (
        <loaded.SelectTrigger ref={ref} data-fp-trigger="" className={className} {...props}>
          {children}
        </loaded.SelectTrigger>
      );
    }
    return (
      <DeferredTrigger
        ref={ref}
        role="combobox"
        aria-autocomplete="none"
        popup="listbox"
        opensOn="press"
        keys={["Enter", " ", "ArrowDown", "ArrowUp"]}
        className={cn(SELECT_TRIGGER_CLASS, INVALID_CLASS, className)}
        {...props}
      >
        {children}
        <ChevronDown aria-hidden className="fp-h-4 fp-w-4 fp-opacity-50" />
      </DeferredTrigger>
    );
  },
);

const SelectValue = React.forwardRef<HTMLSpanElement, PartProps<"SelectValue">>(
  function SelectValue({ children, placeholder, ...props }, ref) {
    const loaded = selects.useLoaded();
    // Without children only Radix knows the picked option's text, so fetch it at once.
    React.useEffect(() => {
      if (children === undefined) void selects.ensure();
    }, [children]);
    if (loaded) {
      return (
        <loaded.SelectValue ref={ref} placeholder={placeholder} {...props}>
          {children}
        </loaded.SelectValue>
      );
    }
    return (
      <span ref={ref} className="fp-pointer-events-none">
        {children ?? placeholder}
      </span>
    );
  },
);

/** A part that only shows inside an open select, so it renders nothing until the select's code is there. */
function inside<K extends keyof typeof Parts>(name: K) {
  return React.forwardRef<HTMLDivElement, PartProps<K>>(function SelectPart(props, ref) {
    const loaded = selects.useLoaded();
    if (!loaded) return null;
    const Part: React.ElementType = loaded[name];
    return <Part ref={ref} {...props} />;
  });
}

const SelectContent = inside("SelectContent");
const SelectGroup = inside("SelectGroup");
const SelectItem = inside("SelectItem");
const SelectLabel = inside("SelectLabel");
const SelectSeparator = inside("SelectSeparator");

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
