import type { FlowPanelConfig } from "@flowpanel/core";
import { createContext, useContext } from "react";

export interface FlowPanelContextValue {
  config: FlowPanelConfig;
  timezone: string;
  container: HTMLDivElement | null;
}

export const FlowPanelContext = createContext<FlowPanelContextValue>({
  config: {} as FlowPanelConfig,
  timezone: "UTC",
  container: null,
});

export function useFlowPanelConfig() {
  return useContext(FlowPanelContext).config;
}

export function useFlowPanelContainer() {
  return useContext(FlowPanelContext).container;
}
