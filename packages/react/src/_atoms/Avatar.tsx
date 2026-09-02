"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultAvatar } from "./AvatarDefault";

export { type AvatarProps, DefaultAvatar } from "./AvatarDefault";

export function Avatar(props: import("./AvatarDefault").AvatarProps): React.JSX.Element {
  const Slot = useComponent("Avatar", DefaultAvatar);
  return <Slot {...props} />;
}
