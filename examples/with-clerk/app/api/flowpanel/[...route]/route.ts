import { handlers } from "@flowpanel/kit/next";
import config from "@/src/flowpanel.config";

export const { GET, POST } = handlers(config);
