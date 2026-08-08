"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultPageHeader } from "./PageHeaderDefault.js";

export { DefaultPageHeader, type PageHeaderProps } from "./PageHeaderDefault.js";

export function PageHeader(
  props: import("./PageHeaderDefault.js").PageHeaderProps,
): React.JSX.Element {
  const Slot = useComponent("PageHeader", DefaultPageHeader);
  return <Slot {...props} />;
}
