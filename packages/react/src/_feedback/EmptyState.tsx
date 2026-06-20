"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { DefaultEmptyState, type EmptyStateProps } from "./EmptyStateDefault.js";

/** falling back to DefaultEmptyState. */
export function EmptyState(
  props: import("./EmptyStateDefault.js").EmptyStateProps,
): React.JSX.Element {
  const Slot = useComponents().EmptyState;
  return <Slot {...props} />;
}
