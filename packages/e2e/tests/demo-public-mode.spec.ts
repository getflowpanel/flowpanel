import { expect, test } from "@playwright/test";

test("@public-demo public demo explains its private interactive contract", async ({ page }) => {
  await page.goto("/admin/products");

  await expect(page.getByText("Interactive sandbox", { exact: true })).toBeVisible();
  await expect(page.getByText(/Private to this browser/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add new" })).toBeVisible();
});
