"use client";
import { Button, Drawer, DrawerContent, DrawerHeader, useUrlState } from "@flowpanel/react";
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
export function CreateDrawer({ label, title, children }: CreateDrawerProps) {
  const url = useUrlState();
  const open = url.get("create") === "1";

  return (
    <>
      <Button onClick={() => url.set({ create: "1" })}>{label}</Button>
      <Drawer
        open={open}
        onOpenChange={(next) => url.set({ create: next ? "1" : null })}
        width="md"
        title={title}
      >
        <DrawerHeader>
          <h2 className="text-base font-medium text-fp-text-1">{title}</h2>
        </DrawerHeader>
        <DrawerContent>{children}</DrawerContent>
      </Drawer>
    </>
  );
}
