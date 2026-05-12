import { expect, test } from "@playwright/test";

/**
 * M3 realtime smoke — cross-tab SSE propagation.
 *
 * Scenario:
 *   - Two browser tabs open /admin/users in the same context.
 *   - Tab A opens the row drawer and triggers the "Disable user" action,
 *     which soft-deletes the user (sets deletedAt) and returns
 *     { refresh: true }.
 *   - Server runs publishResource("resource.users", { action: "update" }).
 *   - Tab B's <DataTable realtime="resource.users"> receives the SSE event
 *     via useLiveChannel → router.refresh (debounced ~200ms).
 *   - Tab B's list (filtered to deletedAt IS NULL) re-fetches; the
 *     disabled user is no longer rendered.
 *
 * Budget: 2s from action confirm to tab B reflecting the deletion.
 *
 * Requires freelance-radar + Postgres running; config default
 * realtime.driver is "memory" (in-process publisher).
 */

test.describe("M3 realtime", () => {
  test("cross-tab: soft-delete in tab A removes row in tab B within 2s", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const tabA = await ctx.newPage();
      const tabB = await ctx.newPage();

      await tabA.goto("/admin/users");
      await tabB.goto("/admin/users");

      await expect(tabA.locator("tbody tr").first()).toBeVisible();
      await expect(tabB.locator("tbody tr").first()).toBeVisible();

      const rowsBefore = await tabB.locator("tbody tr").count();
      expect(rowsBefore).toBeGreaterThan(0);

      // Identify the target user by their email, captured from tab A's first row.
      const firstRowA = tabA.locator("tbody tr").first();
      const targetEmail = (await firstRowA.textContent())?.match(/\S+@\S+/)?.[0] ?? "";
      expect(targetEmail).toBeTruthy();

      // Open drawer on that row in tab A.
      await firstRowA.click();
      await expect(tabA.getByRole("dialog")).toBeVisible();

      // Click Disable user → ConfirmDialog → confirm.
      await tabA.getByRole("button", { name: /disable user/i }).click();
      const confirm = tabA.getByRole("alertdialog");
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: /disable user/i }).click();

      // Tab B should drop to rowsBefore - 1 within 2s.
      await expect(tabB.locator("tbody tr")).toHaveCount(rowsBefore - 1, { timeout: 2_000 });

      // Bonus: the target email should no longer appear in tab B.
      await expect(tabB.getByText(targetEmail)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
