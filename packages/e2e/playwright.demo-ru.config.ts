import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e-db";

const BASE_URL = process.env.E2E_RU_BASE_URL ?? "http://localhost:3102";
const PORT = new URL(BASE_URL).port || "3102";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ru-locale.spec.mts",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: BASE_URL, trace: "on-first-retry", actionTimeout: 15_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec tsx start-server.ts",
    url: `${BASE_URL}/admin/products`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT,
      DATABASE_URL: E2E_DATABASE_URL,
      DEMO_MODE: "true",
      DEMO_READ_ONLY: "false",
      DEMO_LOCALE: "ru-RU",
      DEMO_SANDBOX_SECRET: "flowpanel-e2e-ru-locale-sandbox-secret-v1",
      DEMO_SANDBOX_MAX_CREATES_PER_HOUR: "1000",
      NEXT_DIST_DIR: `.next/e2e-ru-${process.pid}`,
    },
  },
});
