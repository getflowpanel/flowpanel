import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

async function createProduct(page: Page, title: string): Promise<string> {
  await page.goto("/admin/products/new");
  await page.getByLabel("SKU").fill(`E2E-${Date.now()}`);
  await page.getByLabel("Product").fill(title);
  await page.getByLabel("Category").selectOption("Headphones");
  await page.getByLabel(/our price/i).fill("1999");
  await page.getByRole("combobox", { name: "Customer" }).click();
  await page.getByRole("listbox").getByRole("option").first().click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/admin\/products(?:\?|$)/);
  await expect(page.getByText(title).first()).toBeVisible();

  await page.locator("tbody tr").filter({ hasText: title }).click();
  await expect(page).toHaveURL(/drawer=products(?::|%3A)/);
  const id = new URL(page.url()).searchParams.get("drawer")?.split(":")[1];
  expect(id).toBeTruthy();
  return id as string;
}

async function exportProductsCsv(page: Page): Promise<string> {
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Export" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export as CSV" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFile(path as string, "utf8");
}

test("sandbox: two browsers receive populated, persistent, isolated data", async ({ browser }) => {
  test.setTimeout(120_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const suffix = `${Date.now()}`;
  const titleA = `Private A product ${suffix}`;
  const editedTitleA = `${titleA} edited`;
  const titleB = `Private B product ${suffix}`;
  const customerA = `Private A customer ${suffix}`;

  try {
    await pageA.goto("/admin/products");
    await pageB.goto("/admin/products");

    await expect(pageA.getByText("Sony WH-1000XM5 Wireless Headphones").first()).toBeVisible();
    await expect(pageB.getByText("Sony WH-1000XM5 Wireless Headphones").first()).toBeVisible();
    await expect(pageA.getByText(/Private to this browser/)).toBeVisible();

    const createdId = await createProduct(pageA, titleA);
    await createProduct(pageB, titleB);

    await pageA.goto(`/admin/products/${createdId}/edit`);
    await pageA.getByLabel("Product").fill(editedTitleA);
    await pageA.getByRole("button", { name: "Save" }).click();
    await expect(pageA).toHaveURL(new RegExp(`/admin/products/${createdId}$`));
    await pageA.reload();
    await expect(pageA.getByText(editedTitleA).first()).toBeVisible();

    await pageB.reload();
    await expect(pageB.getByText(titleA, { exact: false })).toHaveCount(0);
    await pageA.goto("/admin/products");
    await expect(pageA.getByText(titleB, { exact: false })).toHaveCount(0);

    const crossSandboxRead = await pageB.request.get(`/api/flowpanel/products/${createdId}`);
    expect(crossSandboxRead.status()).toBe(404);

    const crossSandboxUpdate = await pageB.request.post(
      `/api/flowpanel/products/${createdId}/edit`,
      { form: { title: "Cross-sandbox overwrite" } },
    );
    expect(crossSandboxUpdate.status()).toBe(404);

    const crossSandboxDelete = await pageB.request.post(
      "/api/flowpanel/products/bulk-actions/delete",
      { data: { ids: [createdId], input: {} } },
    );
    expect(crossSandboxDelete.status()).toBe(404);

    await pageA.reload();
    await expect(pageA.getByText(editedTitleA).first()).toBeVisible();

    const [exportA, exportB] = await Promise.all([
      exportProductsCsv(pageA),
      exportProductsCsv(pageB),
    ]);
    expect(exportA).toContain(editedTitleA);
    expect(exportA).not.toContain(titleB);
    expect(exportB).toContain(titleB);
    expect(exportB).not.toContain(titleA);

    const customerCreate = await pageA.request.post("/api/flowpanel/customers/create", {
      form: {
        email: `private-a-${suffix}@example.test`,
        name: "Private A",
        company: customerA,
        plan: "starter",
        status: "trialing",
      },
    });
    expect(customerCreate.status()).toBe(200);
    const referencePath = `/api/flowpanel/products/reference/customerId?q=${encodeURIComponent(customerA)}`;
    const referenceA = await pageA.request.get(referencePath);
    const referenceB = await pageB.request.get(referencePath);
    expect(referenceA.status()).toBe(200);
    expect(referenceB.status()).toBe(200);
    expect(JSON.stringify(await referenceA.json())).toContain(customerA);
    expect(JSON.stringify(await referenceB.json())).not.toContain(customerA);

    await Promise.all([
      pageA.waitForURL(/\/admin$/),
      pageA.getByRole("button", { name: "support" }).click(),
    ]);
    await pageA.goto("/admin/products");
    await expect(pageA.getByText(editedTitleA).first()).toBeVisible();
    await expect(pageA.getByRole("columnheader", { name: "Our price" })).toHaveCount(0);
    await Promise.all([
      pageA.waitForURL(/\/admin$/),
      pageA.getByRole("button", { name: "admin" }).click(),
    ]);
    await pageA.goto("/admin/products");
    await expect(pageA.getByRole("columnheader", { name: "Our price" })).toBeVisible();
    await expect(pageA.locator("tbody tr").filter({ hasText: editedTitleA })).toContainText(
      "$19.99",
    );

    await pageA.goto("/admin/matches?f_status=needs_review");
    const reviewRow = pageA.locator("tbody tr").first();
    const reviewCheckbox = reviewRow.getByRole("checkbox");
    const reviewLabel = await reviewCheckbox.getAttribute("aria-label");
    const reviewId = reviewLabel?.match(/^Select row (.+)$/)?.[1];
    expect(reviewId).toBeTruthy();
    await reviewRow.getByRole("button", { name: "Row actions" }).click();
    const actionResponsePromise = pageA.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/flowpanel/matches/${reviewId}/actions/confirm`),
    );
    await pageA.getByRole("menuitem", { name: "Confirm match" }).click();
    expect((await actionResponsePromise).status()).toBe(200);
    await expect(pageA.getByText("Match confirmed", { exact: true })).toBeVisible();
    await pageA.reload();
    await expect(pageA.getByRole("checkbox", { name: `Select row ${reviewId}` })).toHaveCount(0);
    const persistedReview = await pageA.request.get(`/api/flowpanel/matches/${reviewId}`);
    expect(persistedReview.status()).toBe(200);
    await expect(persistedReview.json()).resolves.toMatchObject({
      ok: true,
      data: { status: "confirmed" },
    });

    await pageA.goto("/admin/products");
    const disposableRow = pageA.locator("tbody tr").filter({ hasText: editedTitleA });
    await disposableRow.getByRole("checkbox").check();
    const bulkActions = pageA.getByRole("region", { name: "Bulk actions" });
    await bulkActions.getByRole("button", { name: "Action…" }).click();
    await pageA.getByRole("menuitem", { name: "Delete" }).click();
    const deleteDialog = pageA.getByRole("alertdialog");
    await expect(deleteDialog).toContainText("products and their matches");
    await deleteDialog.getByRole("button", { name: "Delete (1)" }).click();
    await expect(pageA.getByText(editedTitleA, { exact: false })).toHaveCount(0);
    await pageA.reload();
    await expect(pageA.getByText(editedTitleA, { exact: false })).toHaveCount(0);

    await pageA.getByRole("button", { name: "Reset data" }).click();
    await expect(pageA.getByText("Original demo data restored for this browser.")).toBeVisible();
    await pageA.goto("/admin/products");
    await expect(pageA.getByText(titleA, { exact: false })).toHaveCount(0);
    await expect(pageA.getByText("Sony WH-1000XM5 Wireless Headphones").first()).toBeVisible();

    await pageB.reload();
    await expect(pageB.getByText(titleB).first()).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("@cross-browser sandbox: mobile reset remains a full-size touch target", async ({
  page,
  isMobile,
}) => {
  await page.goto("/admin");
  const reset = page.getByRole("button", { name: "Reset data" });
  await expect(reset).toBeVisible();
  expect((await reset.boundingBox())?.height).toBeGreaterThanOrEqual(isMobile ? 44 : 32);
});
