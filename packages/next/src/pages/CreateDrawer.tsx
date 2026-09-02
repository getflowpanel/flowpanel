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
 * Opens the create form beside the list instead of navigating away, so the rows
 * behind stay in view. State lives in `?create=1` rather than component state:
 * the drawer then survives a refresh, is linkable, and closes on Back.
 *
 * The form still posts to its own route and redirects to the list on success,
 * which drops the param — so a successful create closes the drawer and
 * re-renders the list in the same navigation.
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
