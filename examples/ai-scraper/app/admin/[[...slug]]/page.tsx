import { createFlowpanel } from "@flowpanel/kit/next";
import config from "@/src/admin/config";

const flowpanel = createFlowpanel(config);

export const generateMetadata = flowpanel.metadata;
export default flowpanel.page;
