"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultStatusBadge } from "./StatusBadgeDefault.js";

export {
  DefaultStatusBadge,
  type StatusBadgeProps,
  type StatusBadgeTone,
} from "./StatusBadgeDefault.js";

export function StatusBadge(
  props: import("./StatusBadgeDefault.js").StatusBadgeProps,
): React.JSX.Element {
  const Slot = useComponent("StatusBadge", DefaultStatusBadge);
  return <Slot {...props} />;
}
