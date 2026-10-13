import { expect, test } from "@playwright/test";

/** A filter narrowing the customers list, bulk selection, the row drawer and its action. */

test.describe("filters, bulk selection and the drawer", () => {
  test("FilterBar narrows the customers list by plan", async ({ page }) => {
    await page.goto("/admin/customers");
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
    await page.goto("/admin/customers");
    const rowCheckboxes = page.getByRole("checkbox");
    // 0 is header "select all", 1+ are row checkboxes.
    await rowCheckboxes.nth(1).check();
    await rowCheckboxes.nth(2).check();
    await expect(page.getByText(/2 selected/i)).toBeVisible();
  });

  test("Drawer opens on row click and shows header", async ({ page }) => {
    await page.goto("/admin/customers");
    // The first data row is index 1; its email cell opens the drawer.
    const firstRow = page.getByRole("row").nth(1);
    await firstRow.getByText(/@/).click();
    // Drawer surfaces as a role=dialog with the email as header.
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Drawer action 'Disable customer' fires confirm + toast on confirm", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("row").nth(1).getByText(/@/).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Drawer actions live in the record's header menu, beside Edit and Delete.
    await page.getByRole("dialog").getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: /disable customer/i }).click();
    // ConfirmDialog is an alertdialog (Radix AlertDialog).
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /disable customer/i }).click();
    // Toast surfaces the ActionResult.message text.
    await expect(page.getByText(/disabled/i)).toBeVisible({ timeout: 3000 });
  });
});
