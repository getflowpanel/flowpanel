"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultPagination } from "./PaginationDefault.js";

export { DefaultPagination, type PaginationProps } from "./PaginationDefault.js";

export function Pagination(
  props: import("./PaginationDefault.js").PaginationProps,
): React.JSX.Element {
  const Slot = useComponent("Pagination", DefaultPagination);
  return <Slot {...props} />;
}
