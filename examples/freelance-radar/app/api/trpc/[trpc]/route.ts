import { createFlowPanelHandler } from "@flowpanel/core";
import { flowpanel } from "@/src/flowpanel";

const handler = createFlowPanelHandler(flowpanel);

export const { GET, POST } = handler;
export type AppRouter = typeof handler.router;
