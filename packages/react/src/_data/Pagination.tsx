"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { DefaultPagination, type PaginationProps } from "./PaginationDefault.js";

export function Pagination(
  props: import("./PaginationDefault.js").PaginationProps,
): React.JSX.Element {
  const Slot = useComponents().Pagination;
  return <Slot {...props} />;
}
