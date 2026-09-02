"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultPageHeader } from "./PageHeaderDefault";

export { DefaultPageHeader, type PageHeaderProps } from "./PageHeaderDefault";

export function PageHeader(
  props: import("./PageHeaderDefault").PageHeaderProps,
): React.JSX.Element {
  const Slot = useComponent("PageHeader", DefaultPageHeader);
  return <Slot {...props} />;
}
