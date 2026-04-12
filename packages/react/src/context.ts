import { createContext, useContext } from "react";

interface FlowPanelContextValue {
  timezone: string;
}

export const FlowPanelContext = createContext<FlowPanelContextValue>({
  timezone: "UTC",
});

export function useFlowPanel(): FlowPanelContextValue {
  return useContext(FlowPanelContext);
}
