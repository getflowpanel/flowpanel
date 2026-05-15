"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultPagination, type PaginationProps } from "./PaginationDefault.js";

/** Renders whatever override the user registered via theme.components.Pagination,
 *  falling back to DefaultPagination. */
export function Pagination(
  props: import("./PaginationDefault.js").PaginationProps,
): React.JSX.Element {
  const Slot = useComponents().Pagination;
  return <Slot {...props} />;
}
