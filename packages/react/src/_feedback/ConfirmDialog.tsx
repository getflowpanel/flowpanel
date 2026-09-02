"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultConfirmDialog } from "./ConfirmDialogDefault";

export { type ConfirmDialogProps, DefaultConfirmDialog } from "./ConfirmDialogDefault";

export function ConfirmDialog(
  props: import("./ConfirmDialogDefault").ConfirmDialogProps,
): React.JSX.Element {
  const Slot = useComponent("ConfirmDialog", DefaultConfirmDialog);
  return <Slot {...props} />;
}
