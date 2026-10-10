import { expect, test } from "@playwright/test";

test("a money field edits major units beside the currency and stores minor units", async ({
  page,
}) => {
  await page.goto("/admin/products");
  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/drawer=products(?::|%3A)/);
  const id = new URL(page.url()).searchParams.get("drawer")?.split(":")[1];
  expect(id).toBeTruthy();

  await page.goto(`/admin/products/${id}/edit`);
  const price = page.getByRole("textbox", { name: "Our price" });
  await expect(price).toHaveValue(/^\d+\.\d{2}$/);
  await expect(page.getByText("$", { exact: true })).toBeVisible();
  await expect(page.getByText(/in cents/i)).toHaveCount(0);

  await price.fill("12.345");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText(
      "Our price has more decimals than its currency keeps. Enter an amount like 12.50",
    ),
  ).toBeVisible();

  await price.fill("1234,5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/products/${id}$`));
  await page.goto(`/admin/products/${id}/edit`);
  await expect(price).toHaveValue("1234.50");
});
