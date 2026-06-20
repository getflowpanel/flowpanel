"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { DefaultPageHeader, type PageHeaderProps } from "./PageHeaderDefault.js";

export function PageHeader(
  props: import("./PageHeaderDefault.js").PageHeaderProps,
): React.JSX.Element {
  const Slot = useComponents().PageHeader;
  return <Slot {...props} />;
}
