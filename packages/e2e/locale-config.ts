import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e-db";

/** The demo booted under one `formatting.locale`, for `locale.spec.mts`; `E2E_LOCALE_BASE_URL` moves its port. */
export function localeConfig(locale: string, defaultPort: number) {
  const baseURL = process.env.E2E_LOCALE_BASE_URL ?? `http://localhost:${defaultPort}`;
  const tag = locale.toLowerCase();
  return defineConfig({
    testDir: "./tests",
    testMatch: "locale.spec.mts",
    fullyParallel: false,
    workers: 1,
    reporter: "line",
    use: { baseURL, trace: "on-first-retry", actionTimeout: 15_000 },
    projects: [{ name: tag, metadata: { locale }, use: { ...devices["Desktop Chrome"] } }],
    webServer: {
      command: "pnpm exec tsx start-server.ts",
      url: `${baseURL}/admin/products`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PORT: new URL(baseURL).port || String(defaultPort),
        DATABASE_URL: E2E_DATABASE_URL,
        DEMO_MODE: "true",
        DEMO_READ_ONLY: "false",
        DEMO_LOCALE: locale,
        DEMO_SANDBOX_SECRET: `flowpanel-e2e-${tag}-locale-sandbox-secret-v1`,
        DEMO_SANDBOX_MAX_CREATES_PER_HOUR: "1000",
        NEXT_DIST_DIR: `.next/e2e-${tag}-${process.pid}`,
      },
    },
  });
}
