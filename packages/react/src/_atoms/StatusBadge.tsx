"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export {
  DefaultStatusBadge,
  type StatusBadgeProps,
  type StatusBadgeTone,
} from "./StatusBadgeDefault.js";

export function StatusBadge(
  props: import("./StatusBadgeDefault.js").StatusBadgeProps,
): React.JSX.Element {
  const Slot = useComponents().StatusBadge;
  return <Slot {...props} />;
}
