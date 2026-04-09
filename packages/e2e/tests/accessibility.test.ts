import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("accessibility", () => {
  test("main dashboard — zero WCAG AA violations", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector("[data-testid='fp-root']");

    const results = await new AxeBuilder({ page })
      .include("[data-testid='fp-root']")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations).toHaveLength(0);
  });

  test("command palette — zero violations", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector("[data-testid='fp-root']");
    await page.keyboard.press("Meta+k");
    await page.waitForSelector("[role='dialog'][aria-label='Command palette']");

    const results = await new AxeBuilder({ page })
      .include("[role='dialog']")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations).toHaveLength(0);
  });

  test("skip link is present and focusable", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector("[data-testid='fp-root']");

    // Tab once to get to skip link
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toContain("Skip");
  });

  test("header live indicator has aria-label", async ({ page }) => {
    await page.goto("/admin");
    const indicator = page.locator("[aria-label*='Connection']");
    await expect(indicator).toBeVisible();
  });
});
