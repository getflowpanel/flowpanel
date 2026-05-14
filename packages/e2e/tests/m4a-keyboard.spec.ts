import { expect, test } from "@playwright/test";

/**
 * M4a — keyboard-only navigation smoke.
 *
 * 1. Tab into skip-to-content link, Enter activates it.
 * 2. Click first row → drawer opens (role=dialog).
 * 3. Esc closes drawer.
 *
 * Requires freelance-radar + Postgres running.
 */
test.describe("M4a — keyboard navigation", () => {
  test("Tab cycles to skip link, Esc closes drawer", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");

    // Ensure focus starts at the document root before tabbing.
    await page.click("body");

    // First Tab should focus the skip-to-content link.
    await page.keyboard.press("Tab");
    const focusedText = await page.evaluate(
      () =>
        (globalThis as unknown as { document: { activeElement: { textContent?: string } | null } })
          .document.activeElement?.textContent ?? "",
    );
    expect(focusedText.toLowerCase()).toContain("skip to main content");

    // Activating the skip link jumps to the main landmark.
    await page.keyboard.press("Enter");

    // Open the drawer by clicking the first row (mouse is fine for the open path).
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Esc closes the drawer.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
