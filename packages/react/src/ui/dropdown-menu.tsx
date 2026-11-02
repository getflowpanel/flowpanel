"use client";
import * as React from "react";
import { DeferredTrigger, deferredModule, useDeferredRoot } from "./deferred";
import type * as Parts from "./dropdown-menu-parts";

const menus = deferredModule(() => import("./dropdown-menu-parts"));

/** Loads the menus' code now, as a test setup does. */
export const preloadMenus = () => menus.ensure();

type PartProps<K extends keyof typeof Parts> = React.ComponentPropsWithoutRef<(typeof Parts)[K]>;

function DropdownMenu(props: React.ComponentProps<typeof Parts.DropdownMenu>) {
  const { loaded, defaultOpen, provide } = useDeferredRoot(menus, props);
  if (loaded) return <loaded.DropdownMenu {...props} defaultOpen={defaultOpen} />;
  return provide(props.children);
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, PartProps<"DropdownMenuTrigger">>(
  function DropdownMenuTrigger(props, ref) {
    const loaded = menus.useLoaded();
    if (loaded) return <loaded.DropdownMenuTrigger ref={ref} data-fp-trigger="" {...props} />;
    return (
      <DeferredTrigger
        ref={ref}
        popup="menu"
        opensOn="press"
        keys={["Enter", " ", "ArrowDown"]}
        {...props}
      />
    );
  },
);

/** A part that only shows inside an open menu, so it renders nothing until the menu's code is there. */
function inside<K extends keyof typeof Parts>(name: K) {
  return React.forwardRef<HTMLDivElement, PartProps<K>>(function MenuPart(props, ref) {
    const loaded = menus.useLoaded();
    if (!loaded) return null;
    const Part: React.ElementType = loaded[name];
    return <Part ref={ref} {...props} />;
  });
}

const DropdownMenuContent = inside("DropdownMenuContent");
const DropdownMenuItem = inside("DropdownMenuItem");
const DropdownMenuCheckboxItem = inside("DropdownMenuCheckboxItem");
const DropdownMenuLabel = inside("DropdownMenuLabel");
const DropdownMenuSeparator = inside("DropdownMenuSeparator");
const DropdownMenuShortcut = inside("DropdownMenuShortcut");
const DropdownMenuGroup = inside("DropdownMenuGroup");
const DropdownMenuSub = inside("DropdownMenuSub");
const DropdownMenuSubContent = inside("DropdownMenuSubContent");
const DropdownMenuSubTrigger = inside("DropdownMenuSubTrigger");

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
