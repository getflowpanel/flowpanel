import { expect, test } from "@playwright/test";

/**
 * M2 smoke — validates dashboards and the command palette against the
 * ai-scraper example. Prereqs mirror m1-smoke.spec.ts (ai-scraper + Postgres
 * running, db:push + db:seed applied).
 *
 * Row-click-opens-drawer coverage lives in m2.5-smoke.spec.ts
 * ("Drawer opens on row click and shows header") — not duplicated here.
 */

test("dashboard renders metric cards", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: /overview/i })).toBeVisible();
  await expect(page.locator("[data-tone]").first()).toBeVisible();
});

test("cmd+k opens palette", async ({ page }) => {
  await page.goto("/admin");
  await page.keyboard.press("Meta+K");
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
});
