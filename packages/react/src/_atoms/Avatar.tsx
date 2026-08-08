"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultAvatar } from "./AvatarDefault.js";

export { type AvatarProps, DefaultAvatar } from "./AvatarDefault.js";

export function Avatar(props: import("./AvatarDefault.js").AvatarProps): React.JSX.Element {
  const Slot = useComponent("Avatar", DefaultAvatar);
  return <Slot {...props} />;
}
