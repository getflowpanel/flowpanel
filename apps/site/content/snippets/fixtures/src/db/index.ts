import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

export declare const db: NodePgDatabase<typeof schema>;
