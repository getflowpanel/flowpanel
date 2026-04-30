import { handlers } from "flowpanel/next";
import config from "@/flowpanel.config";

export const { GET, POST } = handlers(config);
