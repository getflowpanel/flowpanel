"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultStatusBadge } from "./StatusBadgeDefault";

export {
  DefaultStatusBadge,
  type StatusBadgeProps,
  type StatusBadgeTone,
} from "./StatusBadgeDefault";

export function StatusBadge(
  props: import("./StatusBadgeDefault").StatusBadgeProps,
): React.JSX.Element {
  const Slot = useComponent("StatusBadge", DefaultStatusBadge);
  return <Slot {...props} />;
}
