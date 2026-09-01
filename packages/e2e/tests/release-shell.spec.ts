import { expect, test } from "@playwright/test";

test("@cross-browser release shell is responsive and role-aware", async ({ page, isMobile }) => {
  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("hydrated but some attributes")) {
      hydrationWarnings.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("price intelligence");
  await expect(page.getByRole("link", { name: "Open admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source" })).toBeVisible();
  await expect(page.getByRole("link", { name: /star/i })).toHaveCount(0);

  if (isMobile) {
    for (const control of [
      page.getByRole("button", { name: "admin" }),
      page.getByRole("button", { name: "support" }),
      page.getByRole("link", { name: "View on GitHub" }),
    ]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }

  const hasHorizontalOverflow = await page.evaluate(
    "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1",
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.goto("/admin");
  await expect(page.getByText("FlowPanel demo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "admin" })).toBeVisible();
  await expect(page.getByRole("button", { name: "support" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View on GitHub" })).toBeVisible();
  await expect(page.getByText("Demo guide", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Download brief", { exact: true })).toHaveCount(0);

  if (isMobile) {
    const accountBox = await page.getByRole("button", { name: "Account menu" }).boundingBox();
    expect(accountBox?.height).toBeGreaterThanOrEqual(44);
  }

  await Promise.all([
    page.waitForURL(/\/admin$/),
    page.getByRole("button", { name: "support" }).click(),
  ]);
  await expect(page.getByRole("button", { name: "support" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText("Role: support")).toBeVisible();
  expect(hydrationWarnings).toEqual([]);
});

test("demo persona makes the field-level policy visible", async ({ page }) => {
  await page.goto("/admin");

  await Promise.all([
    page.waitForURL(/\/admin$/),
    page.getByRole("button", { name: "support" }).click(),
  ]);
  await page.goto("/admin/products");
  await expect(page.getByRole("columnheader", { name: "Our price" })).toHaveCount(0);
  await page.getByRole("row").filter({ hasText: "NWA-APP2-USB-C" }).first().click();
  await expect(page.getByText("Our price", { exact: true })).toHaveCount(0);

  await Promise.all([
    page.waitForURL(/\/admin$/),
    page.getByRole("button", { name: "admin" }).click(),
  ]);
  await page.goto("/admin/products");
  await expect(page.getByRole("columnheader", { name: "Our price" })).toBeVisible();
});
