"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultSkeletonTable } from "./SkeletonTableDefault";

export { DefaultSkeletonTable, type SkeletonTableProps } from "./SkeletonTableDefault";

export function SkeletonTable(
  props: import("./SkeletonTableDefault").SkeletonTableProps,
): React.JSX.Element {
  const Slot = useComponent("SkeletonTable", DefaultSkeletonTable);
  return <Slot {...props} />;
}
