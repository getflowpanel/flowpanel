import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e-db";

const BASE_URL = process.env.E2E_READONLY_BASE_URL ?? "http://localhost:3101";
const PORT = new URL(BASE_URL).port || "3101";

export default defineConfig({
  testDir: "./tests",
  testMatch: "demo-readonly.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
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
      DEMO_READ_ONLY: "true",
      DEMO_SANDBOX_SECRET: "flowpanel-e2e-read-only-sandbox-secret-v1",
      DEMO_SANDBOX_MAX_CREATES_PER_HOUR: "1000",
      NEXT_DIST_DIR: `.next/e2e-readonly-${process.pid}`,
    },
  },
});
