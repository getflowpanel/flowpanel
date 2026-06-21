import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Fallback to the docker-compose default if DATABASE_URL is not set.
// Matches `examples/ai-scraper/docker-compose.yml`.
const connectionString = process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/ai_scraper";

export const db = drizzle(new Pool({ connectionString }), { schema });
