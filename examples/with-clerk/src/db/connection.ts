// Fallback matches `examples/with-clerk/docker-compose.yml` (port 54330).
// Imported by drizzle.config.ts outside Next, so keep this dependency-free.
export const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54330/with_clerk";
