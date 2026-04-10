import { createContext } from "react";

export const FlowPanelContext = createContext<{ timezone: string }>({ timezone: "UTC" });
