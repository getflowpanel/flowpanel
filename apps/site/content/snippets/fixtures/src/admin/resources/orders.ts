import { resource } from "@flowpanel/kit";
import { orders } from "@/db/schema";

export const ordersResource = resource(orders, { columns: ["number", "customerEmail", "status"] });
