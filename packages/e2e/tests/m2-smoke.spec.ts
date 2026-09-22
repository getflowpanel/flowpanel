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

test("overview is built from the widget primitives its config declares", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Where the offers come from" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account health" })).toBeVisible();
  for (const label of ["Top marketplaces", "Matching pipeline", "Failing crawls", "AI spend"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  // `refresh: "60s"` stamps how old the numbers are next to the date picker.
  await expect(page.getByText(/^Updated /)).toBeVisible();
});

test("cmd+k opens palette", async ({ page }) => {
  const clientReady = page.waitForRequest((request) =>
    request.url().includes("/api/flowpanel/stream?channel=market-activity"),
  );
  await page.goto("/admin");
  await clientReady;
  await page.keyboard.press("Meta+K");
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
});
