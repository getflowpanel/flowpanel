import { createFlowpanel } from "@flowpanel/kit/next";
import config from "@/src/flowpanel.config";

const flowpanel = createFlowpanel(config);

export const metadata = flowpanel.notFoundMetadata;

export default flowpanel.notFound;
