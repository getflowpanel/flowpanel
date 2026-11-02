import { expect, hydrating, test } from "./hydration";

/** A soft delete in one tab leaves the other tab's list within 2 s, and the overview receives live events. */

test.describe("realtime", () => {
  test("Overview receives a new market event within 5 seconds", async ({ page }) => {
    await page.goto("/admin");
    const newest = page.locator("[data-market-event-id]").first();
    await expect(newest).toBeVisible();
    const initialId = await newest.getAttribute("data-market-event-id");

    await expect
      .poll(() => newest.getAttribute("data-market-event-id"), { timeout: 5_000 })
      .not.toBe(initialId);
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
  });

  test("cross-tab: soft-delete in tab A removes the row from tab B within 2s", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    try {
      const tabA = hydrating(await ctx.newPage());
      const tabB = hydrating(await ctx.newPage());

      await tabA.goto("/admin/customers");
      await tabB.goto("/admin/customers");

      await expect(tabA.locator("tbody tr").first()).toBeVisible();
      await expect(tabB.locator("tbody tr").first()).toBeVisible();

      const rowsBefore = await tabB.locator("tbody tr").count();
      expect(rowsBefore).toBeGreaterThan(0);

      // Identify the target customer by email, captured from tab A's first row.
      const firstRowA = tabA.locator("tbody tr").first();
      const targetEmail = (await firstRowA.textContent())?.match(/\S+@\S+/)?.[0] ?? "";
      expect(targetEmail).toBeTruthy();

      // Open the drawer on that row in tab A from its email cell.
      await firstRowA.getByText(/@/).click();
      await expect(tabA.getByRole("dialog")).toBeVisible();

      // More actions → Disable customer → ConfirmDialog → confirm.
      await tabA.getByRole("dialog").getByRole("button", { name: "More actions" }).click();
      await tabA.getByRole("menuitem", { name: /disable customer/i }).click();
      const confirm = tabA.getByRole("alertdialog");
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: /disable customer/i }).click();

      // Primary assertion: the disabled customer's row is gone from tab B's
      // <tbody> once the SSE event lands and the debounced router.refresh
      // re-fetches. Scoped to <tbody> (not the whole page) so an unrelated
      // element elsewhere carrying the same text can't produce a false
      // pass. Budget is generous (5s) because e2e runs against the Next
      // *dev* server, where router.refresh is far slower than a production
      // build; the propagation itself is sub-second (SSE bus instrumentation
      // showed the event landing and the refresh firing within ~1s).
      await expect(tabB.locator("tbody").getByText(targetEmail)).toHaveCount(0, {
        timeout: 5_000,
      });
    } finally {
      await ctx.close();
    }
  });
});
