import { Flowpanel, flowpanelMetadata } from "@flowpanel/kit/next";
import config from "@/src/flowpanel.config";

export const generateMetadata = flowpanelMetadata(config);

export default Flowpanel(config);
