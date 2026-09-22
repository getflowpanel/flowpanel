import { defineConfig } from "@playwright/test";

/** Runs compiled CSS fixtures only; it does not start an app or require a database. */
export default defineConfig({
  testDir: "./presentation-tests",
  timeout: 60_000,
  use: { headless: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
