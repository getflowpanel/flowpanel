import { expect, test } from "@playwright/test";

async function scrollPosition(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}

test("primary navigation opens the next page at the top", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/admin");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await scrollPosition(page)).toBeGreaterThan(0);

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Customers", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/customers$/);

  await expect.poll(() => scrollPosition(page)).toBeLessThanOrEqual(1);
});

test("opening and closing a drawer preserves the background scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/admin/customers");
  await page.evaluate(() => window.scrollTo(0, 240));
  const before = await scrollPosition(page);
  expect(before).toBeGreaterThan(0);

  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\?drawer=customers%3A\d+$/);
  await expect.poll(() => scrollPosition(page)).toBeCloseTo(before, 0);

  await page.getByRole("tab", { name: "Monitors" }).click();
  await expect(page).toHaveURL(/[?&]tab=monitors(?:&|$)/);
  await expect.poll(() => scrollPosition(page)).toBeCloseTo(before, 0);

  await page.getByRole("button", { name: "Close drawer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/customers$/);
  await expect.poll(() => scrollPosition(page)).toBeCloseTo(before, 0);
});

test("changing an in-page filter preserves the current reading position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/admin/customers");
  await page.evaluate(() => window.scrollTo(0, 100));

  const planFilter = page
    .getByRole("combobox")
    .filter({ hasText: /all|plan/i })
    .first();
  await planFilter.click();
  const before = await scrollPosition(page);
  expect(before).toBeGreaterThan(0);
  await page.getByRole("option", { name: /pro/i }).first().click();
  await expect(page).toHaveURL(/f_plan=pro/);

  await expect.poll(() => scrollPosition(page)).toBeCloseTo(before, 0);
});
