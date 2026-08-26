"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultPagination } from "./PaginationDefault";

export { DefaultPagination, type PaginationProps } from "./PaginationDefault";

export function Pagination(
  props: import("./PaginationDefault").PaginationProps,
): React.JSX.Element {
  const Slot = useComponent("Pagination", DefaultPagination);
  return <Slot {...props} />;
}
