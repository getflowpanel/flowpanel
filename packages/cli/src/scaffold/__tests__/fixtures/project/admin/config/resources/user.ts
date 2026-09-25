import { resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

export const user = resource(schema.user, {});
