import { expect, test } from "@playwright/test";

/**
 * M1 smoke — validates the minimum viable user-facing flow:
 *  1. List page renders from config with correct columns.
 *  2. Keyboard navigation (j + Enter) opens detail.
 *  3. Create flow: form → submit → new row appears.
 *  4. Edit flow: row → edit → save → change is visible.
 *
 * Runs against examples/freelance-radar; assumes db:push + db:seed have
 * been applied (see playwright.config.ts header).
 */

test("admin renders users list from config", async ({ page }) => {
  await page.goto("/admin");
  // First resource in config is Users — its header and columns should render.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/users/i);
  const headers = page.locator("table thead th");
  await expect(headers).toContainText(["email"]);
});

test("keyboard nav: j moves cursor, Enter opens detail", async ({ page }) => {
  await page.goto("/admin/users");
  await page.locator("tbody").focus();
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
});

test("create flow: new user", async ({ page }) => {
  await page.goto("/admin/users/new");
  await page.getByLabel(/email/i).fill("e2e@test.co");
  // "plan" has a default ("free") so email alone should satisfy required fields.
  await page.getByRole("button", { name: /create|save/i }).click();
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(page.getByText("e2e@test.co")).toBeVisible();
});

test("edit flow: update existing user", async ({ page }) => {
  await page.goto("/admin/users");
  await page.getByText("e2e@test.co").click();
  await page.getByRole("link", { name: /edit/i }).click();
  await page.getByLabel(/email/i).fill("e2e+edited@test.co");
  await page.getByRole("button", { name: /save|update/i }).click();
  await expect(page.getByText("e2e+edited@test.co")).toBeVisible();
});
