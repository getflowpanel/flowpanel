import { expect, test } from "@playwright/test";

const viewports = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

const themes = ["light", "dark"] as const;

async function expectNoPageOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`${viewport.name} ${theme} keeps the landing and admin within the viewport`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((choice) => localStorage.setItem("fp-theme", choice), theme);

      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("price intelligence");
      await expectNoPageOverflow(page);

      // A document navigation exercises the pre-hydration theme script as it
      // runs in production on a direct visit or reload.
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-flowpanel-theme", theme);
      await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      await expectNoPageOverflow(page);
    });
  }
}

test("the five-screen product story stays navigable without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const route of [
    "/admin",
    "/admin/customers",
    "/admin/monitors",
    "/admin/products",
    "/admin/matches",
  ]) {
    await page.goto(route);
    await expectNoPageOverflow(page);
  }

  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
});
