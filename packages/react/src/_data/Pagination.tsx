"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { useLabels } from "../_provider/LabelsContext";
import { DefaultPagination, resolvePaginationLabels } from "./PaginationDefault";

export { DefaultPagination, type PaginationProps } from "./PaginationDefault";

export function Pagination(
  props: import("./PaginationDefault").PaginationProps,
): React.JSX.Element {
  const Slot = useComponent("Pagination", DefaultPagination);
  const labels = useLabels();
  return <Slot {...props} labels={resolvePaginationLabels(props.labels, labels.pagination)} />;
}
