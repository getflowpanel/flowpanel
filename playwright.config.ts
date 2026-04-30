import { defineConfig } from "@playwright/test";

/**
 * M1 smoke tests against the freelance-radar example.
 *
 * Prereqs before `pnpm exec playwright test`:
 *   cd examples/freelance-radar
 *   docker compose up -d --wait
 *   DATABASE_URL=postgresql://fp:fp@localhost:54329/freelance_radar pnpm db:push
 *   DATABASE_URL=... pnpm db:seed     # optional — seeds 3 users/categories/jobs
 *
 * Playwright boots the dev server itself via webServer.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter freelance-radar dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://fp:fp@localhost:54329/freelance_radar",
    },
  },
});
