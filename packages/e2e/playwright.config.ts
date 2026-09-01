import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e-db";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PORT = new URL(BASE_URL).port || "3100";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "demo-readonly.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      grep: /@cross-browser/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit",
      grep: /@cross-browser/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    // Boots the ai-scraper example only after its isolated database is ready,
    // using its own .next build dir and never a server anyone else is using.
    command: "pnpm exec tsx start-server.ts",
    url: `${BASE_URL}/admin`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT,
      DATABASE_URL: E2E_DATABASE_URL,
      DEMO_MODE: "true",
      DEMO_READ_ONLY: "false",
      DEMO_SANDBOX_SECRET: "flowpanel-e2e-private-sandbox-secret-v1",
      DEMO_SANDBOX_MAX_ACTIVE: "500",
      DEMO_SANDBOX_MAX_CREATES_PER_HOUR: "1000",
      // A prior dev-server shutdown can remove its cache slightly after the port is released.
      // Isolate each Playwright invocation so rapid local reruns cannot corrupt the next server.
      NEXT_DIST_DIR: `.next/e2e-${process.pid}`,
    },
  },
});
