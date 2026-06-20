"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { type ConfirmDialogProps, DefaultConfirmDialog } from "./ConfirmDialogDefault.js";

export function ConfirmDialog(
  props: import("./ConfirmDialogDefault.js").ConfirmDialogProps,
): React.JSX.Element {
  const Slot = useComponents().ConfirmDialog;
  return <Slot {...props} />;
}
