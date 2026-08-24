import { expect, test } from "@playwright/test";

test("canonical demo exposes one coherent five-screen journey", async ({ page }) => {
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin" });

  await expect(
    page.getByText(
      "Monitor customer catalogs, marketplace coverage, crawl health, and AI-assisted matching.",
    ),
  ).toBeVisible();
  for (const label of ["Active monitors", "Offers discovered", "Crawl success", "Needs review"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  for (const removed of [
    "Download brief",
    "Customer growth",
    "Daily signups",
    "Confidence by model",
  ]) {
    await expect(page.getByText(removed, { exact: true })).toHaveCount(0);
  }

  await expect(nav.getByRole("link")).toHaveText([
    "Overview",
    "Customers",
    "Monitors",
    "Products",
    "Review",
  ]);

  for (const [href, heading] of [
    ["/admin/customers", "Customers"],
    ["/admin/monitors", "Monitors"],
    ["/admin/products", "Products"],
    ["/admin/matches", "Review"],
  ] as const) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }

  for (const label of ["Runs", "Offers", "Invoices", "AI usage", "Demo guide", "Monitoring"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
});

test("overview widgets honor their declared 12-column spans", async ({ page }) => {
  await page.goto("/admin");

  const offersChart = page.getByRole("link", { name: "Offers discovered" }).last();
  const marketActivity = page.getByRole("region", { name: "Market activity" });
  const chartBox = await offersChart.boundingBox();
  const activityBox = await marketActivity.boundingBox();

  expect(chartBox).not.toBeNull();
  expect(activityBox).not.toBeNull();
  expect(chartBox?.width).toBeGreaterThan(700);
  expect(activityBox?.width).toBeGreaterThan(300);
});
