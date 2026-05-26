import { stream } from "flowpanel/next";
import config from "@/src/flowpanel.config";

export const GET = stream(config);
