import { expect, test } from "@playwright/test";

test("emergency read-only mode hides writes and rejects direct mutations", async ({ page }) => {
  await page.goto("/admin/products");

  await expect(page.getByText("Demo maintenance", { exact: true })).toBeVisible();
  await expect(page.getByText(/Editing is temporarily disabled/)).toBeVisible();
  await expect(page.getByRole("link", { name: /new product/i })).toHaveCount(0);

  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/flowpanel/products/create", {
    headers: { origin },
    form: {
      sku: "READ-ONLY-MUST-NOT-WRITE",
      title: "Blocked mutation",
      category: "Headphones",
      ourPriceCents: "1999",
      customerId: "1",
    },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ ok: false });
});
