import { expect, test } from "@playwright/test";

/**
 * M2 smoke — validates dashboards, drawers, and the command palette against
 * the freelance-radar example. Prereqs mirror m1-smoke.spec.ts (docker DB +
 * db:push + db:seed — see playwright.config.ts header).
 */

test("dashboard renders metric cards", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: /overview/i })).toBeVisible();
  await expect(page.locator("[data-tone]").first()).toBeVisible();
});

test("row click opens drawer", async ({ page }) => {
  await page.goto("/admin/users");
  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/drawer=users:/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("cmd+k opens palette", async ({ page }) => {
  await page.goto("/admin");
  await page.keyboard.press("Meta+K");
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
});
