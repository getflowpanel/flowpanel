import { expect, test } from "@playwright/test";

test.skip(process.env.DEMO_MODE !== "true", "runs against the public read-only server only");

test("@public-demo public demo removes write affordances and rejects a direct mutation", async ({
  page,
}) => {
  await page.goto("/admin/products");

  await expect(page.getByRole("status")).toHaveText(
    "Public sandbox · Data resets hourly · Editing is disabled",
  );
  await expect(page.getByRole("link", { name: /new product/i })).toHaveCount(0);

  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/flowpanel/products/create", {
    headers: { origin },
    form: {
      sku: "PUBLIC-DEMO-MUST-NOT-WRITE",
      title: "Blocked public mutation",
      category: "Headphones",
      ourPriceCents: "1999",
      customerId: "1",
    },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: expect.stringMatching(/disabled|read-only/i),
  });
});
