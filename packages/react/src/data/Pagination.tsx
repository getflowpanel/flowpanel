"use client";
import type * as React from "react";
import { useComponent } from "../provider/ComponentsContext";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { DefaultPagination, resolvePaginationLabels } from "./PaginationDefault";

export { DefaultPagination, type PaginationProps } from "./PaginationDefault";

export function Pagination(
  props: import("./PaginationDefault").PaginationProps,
): React.JSX.Element {
  const Slot = useComponent("Pagination", DefaultPagination);
  const labels = useLabels();
  const { locale } = useFormatting();
  return (
    <Slot
      {...props}
      labels={resolvePaginationLabels(props.labels, labels.pagination)}
      locale={props.locale ?? locale}
    />
  );
}
