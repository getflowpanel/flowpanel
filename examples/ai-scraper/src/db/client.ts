import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "./connection";
import * as schema from "./schema";

export const db = drizzle(new Pool({ connectionString: databaseUrl }), { schema });
