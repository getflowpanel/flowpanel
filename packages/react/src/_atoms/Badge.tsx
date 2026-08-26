"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultBadge } from "./BadgeDefault";

export { type BadgeProps, type BadgeTone, DefaultBadge } from "./BadgeDefault";

export function Badge(props: import("./BadgeDefault").BadgeProps): React.JSX.Element {
  const Slot = useComponent("Badge", DefaultBadge);
  return <Slot {...props} />;
}
