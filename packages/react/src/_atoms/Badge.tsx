"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultBadge } from "./BadgeDefault.js";

export { type BadgeProps, type BadgeTone, DefaultBadge } from "./BadgeDefault.js";

export function Badge(props: import("./BadgeDefault.js").BadgeProps): React.JSX.Element {
  const Slot = useComponent("Badge", DefaultBadge);
  return <Slot {...props} />;
}
