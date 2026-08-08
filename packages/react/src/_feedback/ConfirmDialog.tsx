"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultConfirmDialog } from "./ConfirmDialogDefault.js";

export { type ConfirmDialogProps, DefaultConfirmDialog } from "./ConfirmDialogDefault.js";

export function ConfirmDialog(
  props: import("./ConfirmDialogDefault.js").ConfirmDialogProps,
): React.JSX.Element {
  const Slot = useComponent("ConfirmDialog", DefaultConfirmDialog);
  return <Slot {...props} />;
}
