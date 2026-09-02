import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * M4a — axe-core a11y smoke.
 *
 * Runs against the ai-scraper dev server (boots via Playwright webServer).
 * Requires the example's Postgres to be reachable; on CI, brought up via docker-compose.
 *
 * Automated axe coverage through WCAG 2.2 AA. This is a regression gate,
 * not a substitute for manual keyboard and assistive-technology testing.
 */
test.describe("M4a — axe a11y", () => {
  for (const route of ["/admin", "/admin/customers", "/admin/matches"]) {
    test(`${route} has 0 automated WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(route);
      // Wait for the main landmark to render — NOT networkidle, which never
      // settles on pages holding a live SSE (realtime) connection.
      await page.locator("main").first().waitFor({ state: "visible" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
