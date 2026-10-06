import { createFlowpanel } from "@flowpanel/kit/next";
import config from "@/src/flowpanel.config";

const flowpanel = createFlowpanel(config);

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = flowpanel.handlers;
