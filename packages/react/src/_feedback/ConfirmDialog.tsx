"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialogDefault.js";

/** Renders whatever override the user registered via theme.components.ConfirmDialog,
 *  falling back to DefaultConfirmDialog. */
export function ConfirmDialog(
  props: import("./ConfirmDialogDefault.js").ConfirmDialogProps,
): React.JSX.Element {
  const Slot = useComponents().ConfirmDialog;
  return <Slot {...props} />;
}
