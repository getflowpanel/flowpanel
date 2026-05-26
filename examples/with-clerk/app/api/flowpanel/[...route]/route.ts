import { handlers } from "flowpanel/next";
import config from "@/src/flowpanel.config";

export const { GET, POST } = handlers(config);
