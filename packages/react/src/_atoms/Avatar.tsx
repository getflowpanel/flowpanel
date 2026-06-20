"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { type AvatarProps, DefaultAvatar } from "./AvatarDefault.js";

export function Avatar(props: import("./AvatarDefault.js").AvatarProps): React.JSX.Element {
  const Slot = useComponents().Avatar;
  return <Slot {...props} />;
}
