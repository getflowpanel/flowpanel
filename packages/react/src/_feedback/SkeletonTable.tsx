"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultSkeletonTable } from "./SkeletonTableDefault.js";

export { DefaultSkeletonTable, type SkeletonTableProps } from "./SkeletonTableDefault.js";

export function SkeletonTable(
  props: import("./SkeletonTableDefault.js").SkeletonTableProps,
): React.JSX.Element {
  const Slot = useComponent("SkeletonTable", DefaultSkeletonTable);
  return <Slot {...props} />;
}
