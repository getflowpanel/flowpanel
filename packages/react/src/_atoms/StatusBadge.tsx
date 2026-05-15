"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export {
  DefaultStatusBadge,
  type StatusBadgeProps,
  type StatusBadgeTone,
} from "./StatusBadgeDefault.js";

/** Renders whatever override the user registered via theme.components.StatusBadge,
 *  falling back to DefaultStatusBadge. */
export function StatusBadge(
  props: import("./StatusBadgeDefault.js").StatusBadgeProps,
): React.JSX.Element {
  const Slot = useComponents().StatusBadge;
  return <Slot {...props} />;
}
