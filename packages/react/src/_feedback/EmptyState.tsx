"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultEmptyState } from "./EmptyStateDefault";

export { DefaultEmptyState, type EmptyStateProps } from "./EmptyStateDefault";

/** falling back to DefaultEmptyState. */
export function EmptyState(
  props: import("./EmptyStateDefault").EmptyStateProps,
): React.JSX.Element {
  const Slot = useComponent("EmptyState", DefaultEmptyState);
  return <Slot {...props} />;
}
