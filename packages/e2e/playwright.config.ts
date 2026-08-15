import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e-db.js";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PORT = new URL(BASE_URL).port || "3100";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Boots the ai-scraper example against its own DB (see global-setup.ts)
    // and its own .next build dir, never a server or DB anyone else is using.
    command: "pnpm --filter ai-scraper dev",
    url: `${BASE_URL}/admin`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT,
      DATABASE_URL: E2E_DATABASE_URL,
      // Nested under ".next" so the existing ".next/" gitignore rule covers it.
      NEXT_DIST_DIR: ".next/e2e",
    },
  },
});
