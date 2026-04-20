import { expect, test } from "@playwright/test";

// Smoke test for the Phase 1 resource system: verify the Users tab (auto-generated
// from the mock /resource.schema endpoint) renders and the list loads rows.

test.describe("resources (Phase 1 smoke)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector("[data-testid='fp-root']", { timeout: 15_000 });
  });

  test("Users tab is auto-added from resource.schema", async ({ page }) => {
    // The Users tab is added by FlowPanelUI fetching /flowpanel.resource.schema.
    // Wait for it to appear.
    await expect(page.getByRole("tab", { name: /^Users$/ })).toBeVisible({ timeout: 10_000 });
  });

  test("clicking Users tab renders the resource table with rows", async ({ page }) => {
    const usersTab = page.getByRole("tab", { name: /^Users$/ });
    await usersTab.waitFor({ state: "visible", timeout: 10_000 });
    await usersTab.click();

    // Expect the page heading to show "Users" (labelPlural from schema)
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    // Rows from MOCK_USERS should appear
    await expect(page.getByText("alice@example.com")).toBeVisible();
    await expect(page.getByText("bob@example.com")).toBeVisible();
    await expect(page.getByText("carol@example.com")).toBeVisible();
  });

  test("search filters rows via the corrected {query} payload (C3 fix)", async ({ page }) => {
    const usersTab = page.getByRole("tab", { name: /^Users$/ });
    await usersTab.waitFor({ state: "visible", timeout: 10_000 });
    await usersTab.click();

    await expect(page.getByText("alice@example.com")).toBeVisible();

    // Type into the search input
    const search = page.getByPlaceholder(/search users/i);
    await search.fill("alice");

    // Debounced 300ms — wait then check Bob is gone and Alice remains
    await expect(page.getByText("alice@example.com")).toBeVisible({ timeout: 2_000 });
    await expect(page.getByText("bob@example.com")).toHaveCount(0);
  });
});
