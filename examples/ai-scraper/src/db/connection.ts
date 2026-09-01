// Fallback matches `examples/ai-scraper/docker-compose.yml`.
// Imported by drizzle.config.ts outside Next, so keep this dependency-free.
export const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/ai_scraper";
