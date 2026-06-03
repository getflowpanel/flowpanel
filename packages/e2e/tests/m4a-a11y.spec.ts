import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * M4a — axe-core a11y smoke.
 *
 * Runs against the freelance-radar dev server (boots via Playwright webServer).
 * Requires the example's Postgres to be reachable; on CI, brought up via docker-compose.
 *
 * Tags: wcag2a, wcag2aa — the spec §23 contract.
 */
test.describe("M4a — axe a11y", () => {
  for (const route of ["/admin", "/admin/users", "/admin/monitoring"]) {
    test(`${route} has 0 wcag2aa violations`, async ({ page }) => {
      await page.goto(route);
      // Wait for the main landmark to render — NOT networkidle, which never
      // settles on pages holding a live SSE (realtime) connection.
      await page.locator("main").first().waitFor({ state: "visible" });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
