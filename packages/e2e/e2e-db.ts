export const E2E_DB_NAME = "ai_scraper_e2e";

export const BASE_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/ai_scraper";

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export const E2E_DATABASE_URL = withDatabase(BASE_DATABASE_URL, E2E_DB_NAME);
