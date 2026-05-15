"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultAvatar, type AvatarProps } from "./AvatarDefault.js";

/** Renders whatever override the user registered via theme.components.Avatar,
 *  falling back to DefaultAvatar. */
export function Avatar(props: import("./AvatarDefault.js").AvatarProps): React.JSX.Element {
  const Slot = useComponents().Avatar;
  return <Slot {...props} />;
}
