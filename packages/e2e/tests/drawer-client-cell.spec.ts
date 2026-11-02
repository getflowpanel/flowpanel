import { expect, test } from "./hydration";

test("a column render that returns a client component shows in the drawer", async ({ page }) => {
  await page.goto("/admin/matches");
  const headers = await page.getByRole("columnheader").allTextContents();
  const model = headers.findIndex((text) => text.trim() === "Model");
  expect(model).toBeGreaterThanOrEqual(0);
  const row = page.locator("tbody tr").first();
  const listed = ((await row.locator("td").nth(model).textContent()) ?? "").trim();
  expect(listed).not.toBe("");
  await row.locator("td").nth(model).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(listed, { exact: true })).toBeVisible({ timeout: 60_000 });
});
