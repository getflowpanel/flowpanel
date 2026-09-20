import { smokeAdmin } from "@flowpanel/test";
import { expect, test } from "@playwright/test";

/**
 * Dogfoods `@flowpanel/test` against the ai-scraper example: one call walks the
 * nav, every dashboard and list it links to, and the first row of each list.
 * Prereqs mirror m1-smoke.spec.ts (ai-scraper + Postgres, db:push + db:seed).
 */
test.describe("@flowpanel/test", () => {
  test("smokeAdmin walks the whole demo admin without an error", async ({ page }) => {
    test.setTimeout(180_000);
    const report = await smokeAdmin(page, { basePath: "/admin", a11y: true });

    expect(report.consoleErrors).toEqual([]);
    expect(report.a11yViolations).toEqual([]);
    // The seven-screen story: the Overview plus six resource lists.
    expect(new Set(report.visited).size).toBeGreaterThanOrEqual(7);
    for (const route of ["/admin", "/admin/customers", "/admin/matches"]) {
      expect(report.visited).toContain(route);
    }
  });
});
