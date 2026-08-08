"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultEmptyState } from "./EmptyStateDefault.js";

export { DefaultEmptyState, type EmptyStateProps } from "./EmptyStateDefault.js";

/** falling back to DefaultEmptyState. */
export function EmptyState(
  props: import("./EmptyStateDefault.js").EmptyStateProps,
): React.JSX.Element {
  const Slot = useComponent("EmptyState", DefaultEmptyState);
  return <Slot {...props} />;
}
