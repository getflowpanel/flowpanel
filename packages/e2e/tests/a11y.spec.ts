import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Automated axe coverage through WCAG 2.2 AA; a regression gate, not a manual audit. */
test.describe("axe WCAG 2.2 AA", () => {
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
