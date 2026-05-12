"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultEmptyState, type EmptyStateProps } from "./EmptyStateDefault.js";

/** Renders whatever override the user registered via theme.components.EmptyState,
 *  falling back to DefaultEmptyState. Use this internally; users keep importing
 *  { EmptyState } as the public name. */
export function EmptyState(
  props: import("./EmptyStateDefault.js").EmptyStateProps,
): React.JSX.Element {
  const Slot = useComponents().EmptyState;
  return <Slot {...props} />;
}
