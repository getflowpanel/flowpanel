import { expect, test } from "@playwright/test";

/**
 * M4a — keyboard accessibility.
 *
 * Verifies the real requirements directly, rather than via a synthetic
 * `Tab` press from <body> — that proxy is unreliable in headless Chromium
 * (the first Tab doesn't deterministically start from the document root),
 * so it tested the harness, not the product.
 *
 * 1. The skip-to-content link is the FIRST focusable element in the document.
 * 2. Activating it (Enter) jumps to the #main landmark.
 * 3. A row opens the drawer; Esc closes it.
 *
 * Requires ai-scraper + Postgres running.
 */
test.describe("M4a — keyboard navigation", () => {
  test("skip link is first focusable and jumps to main; Esc closes drawer", async ({ page }) => {
    await page.goto("/admin/users");
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

    // (2) Focusing it and pressing Enter activates the in-page jump to #main.
    await firstFocusable.focus();
    await expect(firstFocusable).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);

    // (3) Open the drawer by clicking the first row's email cell (company is
    // the inline-edit showcase column and would start editing instead); Esc
    // closes the drawer.
    await page.locator("tbody tr").first().getByText(/@/).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
