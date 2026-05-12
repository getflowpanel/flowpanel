"use client";
import * as React from "react";
// Import only the pure renderer (no context dependency) to avoid circular refs.
import { DefaultEmptyState, type EmptyStateProps } from "../_feedback/EmptyStateDefault.js";
import { DefaultMetricCard, type MetricCardProps } from "../_widgets/MetricCardDefault.js";

export interface FlowpanelComponentSlots {
  EmptyState: React.ComponentType<EmptyStateProps>;
  MetricCard: React.ComponentType<MetricCardProps>;
}

const DEFAULTS: FlowpanelComponentSlots = {
  EmptyState: DefaultEmptyState,
  MetricCard: DefaultMetricCard,
};

const Ctx = React.createContext<FlowpanelComponentSlots>(DEFAULTS);

export function ComponentsProvider({
  value,
  children,
}: {
  value?: Partial<FlowpanelComponentSlots>;
  children: React.ReactNode;
}): React.JSX.Element {
  const merged = React.useMemo(() => ({ ...DEFAULTS, ...(value ?? {}) }), [value]);
  return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
}

export function useComponents(): FlowpanelComponentSlots {
  return React.useContext(Ctx);
}
