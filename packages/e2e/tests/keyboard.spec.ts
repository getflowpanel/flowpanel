import { expect, test } from "@playwright/test";

/** The skip link is the first focusable element and jumps to main; Esc closes the drawer. */
test.describe("keyboard navigation", () => {
  test("skip link is first focusable and jumps to main; Esc closes drawer", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.locator("tbody tr").first().waitFor({ state: "visible" });

    // (1) The skip link must be the first thing a keyboard user reaches, so it
    // must be the first focusable element in DOM order. It's visually hidden
    // (sr-only) until focused, so we don't filter by visibility.
    const firstFocusable = page
      .locator(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      .first();
    await expect(firstFocusable).toHaveAttribute("href", "#main");
    await expect(firstFocusable).toHaveText(/skip to main content/i);
    await expect(page.getByRole("link", { name: /skip to main content/i })).toHaveCount(1);

    // (2) Focusing it and pressing Enter activates the in-page jump to #main.
    await firstFocusable.focus();
    await expect(firstFocusable).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);

    // (3) The first row's email cell opens the drawer; Esc closes it.
    await page.locator("tbody tr").first().getByText(/@/).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
