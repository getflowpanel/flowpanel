"use client";
import * as React from "react";
import {
  DEFAULT_LABELS,
  type LabelsConfig,
  mergeLabels,
  type ResolvedLabels,
} from "@flowpanel/core";

const Ctx = React.createContext<ResolvedLabels>(DEFAULT_LABELS);

export function LabelsProvider({
  value,
  children,
}: {
  value?: LabelsConfig;
  children: React.ReactNode;
}): React.JSX.Element {
  const merged = React.useMemo(() => mergeLabels(value), [value]);
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useLabels(): ResolvedLabels {
  return React.useContext(Ctx);
}
