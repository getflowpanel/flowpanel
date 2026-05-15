"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultSkeletonTable, type SkeletonTableProps } from "./SkeletonTableDefault.js";

/** Renders whatever override the user registered via theme.components.SkeletonTable,
 *  falling back to DefaultSkeletonTable. */
export function SkeletonTable(
  props: import("./SkeletonTableDefault.js").SkeletonTableProps,
): React.JSX.Element {
  const Slot = useComponents().SkeletonTable;
  return <Slot {...props} />;
}
