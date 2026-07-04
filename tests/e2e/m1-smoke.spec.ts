import { expect, test } from "@playwright/test";

/**
 * M1 smoke — validates the minimum viable user-facing flow:
 *  1. List page renders from config with correct columns.
 *  2. Keyboard navigation (j + Enter) opens the row drawer.
 *  3. Create flow: form → submit → new row appears.
 *  4. Edit flow: row → edit → save → change is visible.
 *
 * Runs against examples/ai-scraper; assumes db:push + db:seed have
 * been applied (see playwright.config.ts header). `/admin` itself is the
 * Overview dashboard (covered by m2), so list assertions target
 * /admin/users ("Customers") and the create/edit flows target
 * /admin/products ("Catalog") — the one resource with declared form fields.
 */

test("admin renders customers list from config", async ({ page }) => {
  await page.goto("/admin/users");
  // The users resource is labeled "Customers"; bare-string columns
  // (e.g. "email") humanize into their header labels.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/customers/i);
  const headers = page.locator("table thead th");
  await expect(headers).toContainText(["Email", "Plan", "Status"]);
});

test("keyboard nav: j moves cursor, Enter opens the row drawer", async ({ page }) => {
  await page.goto("/admin/users");
  await page.locator("tbody").focus();
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
  // users sets rowClick: "drawer", so Enter mirrors a row click — the
  // URL-synced drawer opens as ?drawer=users:<id>.
  await expect(page).toHaveURL(/drawer=users:/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("create flow: new catalog product", async ({ page }) => {
  await page.goto("/admin/products/new");
  // sku, title (label "Product"), category, ourPriceCents, and userId are
  // NOT NULL — fill them all. "Customer" is a reference picker (combobox),
  // so pick the first seeded user instead of typing.
  await page.getByLabel("SKU").fill(`E2E-${Date.now()}`);
  await page.getByLabel("Product").fill("E2E test product");
  await page.getByLabel("Category").selectOption("Electronics");
  await page.getByLabel(/our price/i).fill("1999");
  await page.getByRole("combobox", { name: "Search…" }).click();
  await page.getByRole("option").first().click();
  // A successful create stays on the form (no redirect) — wait for the
  // server-action round-trip before leaving the page.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Create" }).click(),
  ]);
  await page.goto("/admin/products");
  await expect(page.getByText("E2E test product").first()).toBeVisible();
});

test("edit flow: update existing product", async ({ page }) => {
  await page.goto("/admin/products");
  // Rows open a drawer whose URL carries the row id (?drawer=products:<id>);
  // newest-first sort makes row 1 the product created above.
  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/drawer=products:/);
  const id = new URL(page.url()).searchParams.get("drawer")?.split(":")[1];
  await page.goto(`/admin/products/${id}/edit`);
  await page.getByLabel("Product").fill("E2E edited product");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await page.goto("/admin/products");
  await expect(page.getByText("E2E edited product").first()).toBeVisible();
});
