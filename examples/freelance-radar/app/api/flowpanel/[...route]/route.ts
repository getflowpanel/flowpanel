import { handlers } from "@flowpanel/kit/next";
import config from "@/flowpanel.config";

export const { GET, POST } = handlers(config);
