import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.SITE_E2E_BASE_URL ?? "http://localhost:3200";
const PORT = new URL(BASE_URL).port || "3200";

export default defineConfig({
  testDir: "./site-tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "line",
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
    command: `pnpm --filter @flowpanel/site dev --port ${PORT}`,
    url: `${BASE_URL}/docs/reference/drawer`,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
