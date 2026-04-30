import { stream } from "flowpanel/next";
import config from "@/flowpanel.config";

export const GET = stream(config);
