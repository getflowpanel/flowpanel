"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultPageHeader, type PageHeaderProps } from "./PageHeaderDefault.js";

/** Renders whatever override the user registered via theme.components.PageHeader,
 *  falling back to DefaultPageHeader. */
export function PageHeader(
  props: import("./PageHeaderDefault.js").PageHeaderProps,
): React.JSX.Element {
  const Slot = useComponents().PageHeader;
  return <Slot {...props} />;
}
