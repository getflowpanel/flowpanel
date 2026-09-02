import { expect, test } from "@playwright/test";

/**
 * M1 smoke — validates the minimum viable user-facing flow:
 *  1. List page renders from config with correct columns.
 *  2. Keyboard navigation (j + Enter) opens the row drawer.
 *  3. Create flow: form → submit → new row appears.
 *  4. Edit flow: row → edit → save → change is visible.
 *
 * Runs against examples/ai-scraper; requires ai-scraper + Postgres running
 * (db:push + db:seed applied — see playwright.config.ts webServer comment).
 * `/admin` itself is the Overview dashboard (covered by m2-smoke), so list
 * assertions target /admin/customers and the create/edit flows target
 * /admin/products — both use the public resource DSL directly.
 */

test("admin renders customers list from config", async ({ page }) => {
  await page.goto("/admin/customers");
  // The customers resource uses a mix of explicit and bare-string columns;
  // (e.g. "email") humanize into their header labels.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/customers/i);
  const headers = page.locator("table thead th");
  await expect(headers).toContainText(["Email", "Plan", "Status"]);
});

test("keyboard nav: j moves cursor, Enter opens the row drawer", async ({ page }) => {
  await page.goto("/admin/customers");
  await page.locator("tbody").focus();
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
  // customers sets rowClick: "drawer", so Enter mirrors a row click — the
  // URL-synced drawer opens as ?drawer=customers:<id> (browsers percent-encode
  // the ":" to %3A in the address bar).
  await expect(page).toHaveURL(/drawer=customers(?::|%3A)/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("create flow: new catalog product", async ({ page }) => {
  await page.goto("/admin/products/new");
  // sku, title (label "Product"), category, ourPriceCents, and customerId are
  // NOT NULL — fill them all. "Customer" is a reference picker (combobox),
  // so pick the first seeded customer instead of typing.
  await page.getByLabel("SKU").fill(`SKU-${Date.now()}`);
  await page.getByLabel("Product").fill("E2E test product");
  await page.getByLabel("Category").selectOption("Headphones");
  await page.getByLabel(/our price/i).fill("1999");
  await page.getByRole("combobox", { name: "Customer" }).click();
  // Scope to the open listbox — the page's Category <select> also carries
  // (inert, closed) role="option" elements that a bare getByRole would match.
  await page.getByRole("listbox").getByRole("option").first().click();
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
  await expect(page).toHaveURL(/drawer=products(?::|%3A)/);
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
