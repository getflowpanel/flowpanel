"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { DefaultSkeletonTable, type SkeletonTableProps } from "./SkeletonTableDefault.js";

export function SkeletonTable(
  props: import("./SkeletonTableDefault.js").SkeletonTableProps,
): React.JSX.Element {
  const Slot = useComponents().SkeletonTable;
  return <Slot {...props} />;
}
