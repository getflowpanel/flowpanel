import { expect, type Page, test } from "@playwright/test";

async function firstProductId(page: Page): Promise<string> {
  await page.goto("/admin/products");
  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/drawer=products(?::|%3A)/);
  const id = new URL(page.url()).searchParams.get("drawer")?.split(":")[1];
  expect(id).toBeTruthy();
  return id as string;
}

async function renameProduct(page: Page, id: string, title: string): Promise<void> {
  await page.goto(`/admin/products/${id}/edit`);
  await page.getByLabel("Product").fill(title);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/products/${id}$`));
}

test("a record's History tab and the Audit log show who changed what, per sandbox", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const mine = await browser.newContext();
  const theirs = await browser.newContext();
  const page = await mine.newPage();
  const other = await theirs.newPage();
  const title = `Audited headphones ${Date.now()}`;

  try {
    const id = await firstProductId(page);
    await page.goto(`/admin/products/${id}`);
    const before = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    await renameProduct(page, id, title);

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page).toHaveURL(/tab=history/);
    const event = page.locator("[data-fp-audit-event]").first();
    await expect(event).toContainText("Updated");
    await expect(event).toContainText("Alex Admin");
    await expect(event.getByRole("definition")).toContainText(before);
    await expect(event.getByRole("definition")).toContainText(title);

    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Audit log" })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit log");
    const logged = page.locator("[data-fp-audit-event]").filter({ hasText: title });
    await expect(logged).toHaveCount(1);
    await logged.getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/${id}$`));

    await page.goto("/admin/audit-log?resource=customers");
    await expect(page.locator("[data-fp-audit-event]").filter({ hasText: title })).toHaveCount(0);
    await expect(page.getByText("No changes match these filters.")).toBeVisible();

    await other.goto("/admin/audit-log");
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Audit log");
    await expect(other.locator("[data-fp-audit-event]").filter({ hasText: title })).toHaveCount(0);
  } finally {
    await mine.close();
    await theirs.close();
  }
});
