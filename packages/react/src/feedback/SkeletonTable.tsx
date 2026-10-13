"use client";
import type * as React from "react";
import { useComponent } from "../provider/ComponentsContext";
import { useLabels } from "../provider/LabelsContext";
import { DefaultSkeletonTable } from "./SkeletonTableDefault";

export { DefaultSkeletonTable, type SkeletonTableProps } from "./SkeletonTableDefault";

export function SkeletonTable(
  props: import("./SkeletonTableDefault").SkeletonTableProps,
): React.JSX.Element {
  const Slot = useComponent("SkeletonTable", DefaultSkeletonTable);
  const { table } = useLabels();
  return <Slot label={table.loading} {...props} />;
}
