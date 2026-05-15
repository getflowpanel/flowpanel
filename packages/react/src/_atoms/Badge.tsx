"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultBadge, type BadgeProps, type BadgeTone } from "./BadgeDefault.js";

/** Renders whatever override the user registered via theme.components.Badge,
 *  falling back to DefaultBadge. */
export function Badge(props: import("./BadgeDefault.js").BadgeProps): React.JSX.Element {
  const Slot = useComponents().Badge;
  return <Slot {...props} />;
}
