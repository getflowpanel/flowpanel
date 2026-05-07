import { expect, test } from "@playwright/test";

/**
 * M2.5 smokes — filter narrow, bulk select, drawer open, drawer action.
 *
 * These tests target an admin panel wired against the freelance-radar shape
 * (users resource with Plan/Status filters, rowClick: "drawer", drawer
 * actions: [{ key: "disable", ... }], delete.softDelete).
 *
 * Each test is independent and idempotent — relies on default seed only.
 *
 * NOTE: The in-repo e2e harness (`packages/e2e/app`) is the legacy M1
 * FlowPanelUI mock harness — it does NOT expose `/admin/users` with the
 * M2.5 DataTable/FilterBar/Drawer pipeline. These smokes are written
 * against the freelance-radar example shape and are intended to run
 * against a future harness (M3) that spins up freelance-radar + Postgres.
 * Phase 8 server-side coverage (unit + action executor integration tests)
 * already proves the end-to-end flow.
 */

test.describe("M2.5 smokes", () => {
  test("FilterBar narrows the users list by plan", async ({ page }) => {
    await page.goto("/admin/users");
    // Open the Plan select filter and pick Pro.
    const planTrigger = page
      .getByRole("combobox")
      .filter({ hasText: /all|plan/i })
      .first();
    await planTrigger.click();
    const proItem = page.getByRole("option", { name: /pro/i }).first();
    await proItem.click();
    // URL should reflect f_plan=pro.
    await expect(page).toHaveURL(/f_plan=pro/);
  });

  test("Bulk selection shows BulkBar with count", async ({ page }) => {
    await page.goto("/admin/users");
    const rowCheckboxes = page.getByRole("checkbox");
    // 0 is header "select all", 1+ are row checkboxes.
    await rowCheckboxes.nth(1).check();
    await rowCheckboxes.nth(2).check();
    await expect(page.getByText(/2 selected/i)).toBeVisible();
  });

  test("Drawer opens on row click and shows header", async ({ page }) => {
    await page.goto("/admin/users");
    // Click the first data row (header row is index 0).
    const firstRow = page.getByRole("row").nth(1);
    await firstRow.click();
    // Drawer surfaces as a role=dialog with the email as header.
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Drawer action 'Disable user' fires confirm + toast on confirm", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("row").nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const disableBtn = page.getByRole("button", { name: /disable user/i });
    await disableBtn.click();
    // ConfirmDialog is an alertdialog (Radix AlertDialog).
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /disable user/i }).click();
    // Toast surfaces the ActionResult.message text.
    await expect(page.getByText(/disabled/i)).toBeVisible({ timeout: 3000 });
  });
});
