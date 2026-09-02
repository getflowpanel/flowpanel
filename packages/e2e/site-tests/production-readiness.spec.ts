import { expect, test } from "@playwright/test";

test("production readiness is one complete, navigable evaluation checklist", async ({ page }) => {
  await page.goto("/docs/guides/production-readiness");
  const article = page.getByRole("article");

  await expect(page.getByRole("heading", { level: 1, name: "Production readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runtime and data ownership" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Security boundary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Release checklist" })).toBeVisible();
  await expect(
    page.getByText("The first-party adapters fail closed", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("control plane", { exact: false })).toBeVisible();

  await expect(article.getByRole("link", { name: "Authentication with Clerk" })).toHaveAttribute(
    "href",
    "/docs/guides/auth-with-clerk",
  );
  await expect(article.getByRole("link", { name: "Roles and permissions" })).toHaveAttribute(
    "href",
    "/docs/guides/permissions",
  );
  await expect(article.getByRole("link", { name: "Multi-tenant scope" })).toHaveAttribute(
    "href",
    "/docs/guides/multi-tenant-scope",
  );
});
