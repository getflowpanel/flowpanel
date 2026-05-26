import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Fallback to the docker-compose default if DATABASE_URL is not set.
// Matches `examples/with-clerk/docker-compose.yml` (port 54330).
const connectionString = process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54330/with_clerk";

export const db = drizzle(new Pool({ connectionString }), { schema });
