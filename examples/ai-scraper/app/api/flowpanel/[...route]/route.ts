import { handlers } from "@flowpanel/kit/next";
import config from "@/src/admin/config";

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = handlers(config);
