"use client";
import {
  Button,
  confirmLeave,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  useUrlState,
} from "@flowpanel/react";
import type { ReactNode } from "react";

export interface CreateDrawerProps {
  /** Trigger label, e.g. "Add new". */
  label: string;
  title: string;
  /** Server-rendered `AutoForm` for the resource's create fields. */
  children: ReactNode;
}

/**
 * Opens the create form beside the list instead of navigating away. State lives in `?create=1`, not component state,
 * so the drawer survives a refresh, is linkable, and a successful create's redirect closes it by dropping the param.
 */
/** Opens the list's create drawer from elsewhere on the page, such as an empty list. */
export function CreateDrawerTrigger({ label }: { label: string }) {
  const url = useUrlState();
  return <Button onClick={() => url.set({ create: "1" })}>{label}</Button>;
}

export function CreateDrawer({ label, title, children }: CreateDrawerProps) {
  const url = useUrlState();
  const open = url.get("create") === "1";

  return (
    <>
      <Button onClick={() => url.set({ create: "1" })}>{label}</Button>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (next) url.set({ create: "1" });
          else confirmLeave(() => url.set({ create: null }));
        }}
        width="md"
      >
        <DrawerHeader>
          <DrawerTitle className="fp-text-base fp-font-medium">{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerContent>{children}</DrawerContent>
      </Drawer>
    </>
  );
}
