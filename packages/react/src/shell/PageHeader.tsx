"use client";
import type * as React from "react";
import { useComponent } from "../provider/ComponentsContext";
import { useLabels } from "../provider/LabelsContext";
import { DefaultPageHeader } from "./PageHeaderDefault";

export { DefaultPageHeader, type PageHeaderProps } from "./PageHeaderDefault";

export function PageHeader(
  props: import("./PageHeaderDefault").PageHeaderProps,
): React.JSX.Element {
  const Slot = useComponent("PageHeader", DefaultPageHeader);
  const { navigation } = useLabels();
  return <Slot breadcrumbLabel={navigation.breadcrumb} {...props} />;
}
