import { expect, test } from "@playwright/test";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    // Wait for loading to complete
    await page.waitForSelector("[data-testid='fp-root']", { timeout: 15_000 });
  });

  test("renders FlowPanel root element", async ({ page }) => {
    await expect(page.locator("[data-testid='fp-root']")).toBeVisible();
  });

  test("metric cards appear", async ({ page }) => {
    // Wait for skeleton loading to resolve
    await page.waitForFunction(
      () => document.querySelectorAll(".fp-card:not([aria-busy='true'])").length > 0,
      { timeout: 10_000 },
    );
    const cards = page.locator(".fp-card");
    await expect(cards.first()).toBeVisible();
  });

  test("pipeline stages section renders", async ({ page }) => {
    await page.waitForSelector("[aria-label='Pipeline stages']", { timeout: 10_000 });
    const stageSection = page.locator("[aria-label='Pipeline stages']");
    await expect(stageSection).toBeVisible();
  });

  test("run log table renders", async ({ page }) => {
    await page.waitForSelector("[aria-label='Pipeline runs']", { timeout: 10_000 });
    await expect(page.locator("[aria-label='Pipeline runs']")).toBeVisible();
  });

  test("time range controls are visible", async ({ page }) => {
    await expect(page.getByRole("group", { name: /time range/i })).toBeVisible();
    // Individual preset buttons exist
    await expect(page.getByRole("button", { name: "24h" })).toBeVisible();
  });

  test("tabs render with Pipeline and Users", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Pipeline" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
  });

  test("demo banner is shown", async ({ page }) => {
    await expect(page.getByRole("status", { name: /demo/i })).toBeVisible();
  });
});
