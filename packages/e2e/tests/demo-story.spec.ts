import { expect, test } from "@playwright/test";

test("canonical demo exposes one coherent seven-screen journey", async ({ page }) => {
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
    "Runs",
    "Offers",
    "Products",
    "Review",
  ]);

  for (const [href, heading] of [
    ["/admin/customers", "Customers"],
    ["/admin/monitors", "Monitors"],
    ["/admin/runs", "Runs"],
    ["/admin/listings", "Offers"],
    ["/admin/products", "Products"],
    ["/admin/matches", "Review"],
  ] as const) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
  }

  for (const label of ["Invoices", "AI usage", "Demo guide", "Monitoring"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
});

test("command palette mirrors primary navigation without hidden datasets", async ({ page }) => {
  const clientReady = page.waitForRequest((request) =>
    request.url().includes("/api/flowpanel/stream?channel=market-activity"),
  );
  await page.goto("/admin");
  await clientReady;
  await page.keyboard.press("Meta+K");

  await expect(page.getByPlaceholder("Search resources, actions…")).toBeVisible();
  await expect(page.getByRole("option", { name: "Offers", exact: true })).toHaveCount(1);
  for (const label of ["Open offers", "Open invoices", "Open AI usage"]) {
    await expect(page.getByRole("option", { name: label, exact: true })).toHaveCount(0);
  }
});

test("overview presents one coherent live operations surface", async ({ page }) => {
  await page.goto("/admin");

  const liveOperations = page.getByRole("region", { name: "Live operations" });
  await expect(liveOperations).toBeVisible();
  await expect(liveOperations.getByText("Throughput", { exact: true })).toBeVisible();
  await expect(liveOperations.getByText("Market activity", { exact: true })).toBeVisible();
  await expect(liveOperations.locator("svg")).toBeVisible();
  await expect(liveOperations.locator(".recharts-area-curve")).toHaveAttribute("d", /^[^C]*$/);
  await expect(page.getByText("Match quality", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Review queue", { exact: true })).toBeVisible();
});

test("live event timestamps never resize their title column", async ({ page }) => {
  await page.goto("/admin");

  const latestEvent = page
    .getByRole("region", { name: "Live operations" })
    .getByRole("list", { name: "Latest market events" })
    .getByRole("listitem")
    .first();
  const time = latestEvent.locator("time");
  const title = latestEvent.locator("[data-market-event-title]");

  await expect(time).toHaveText("now", { timeout: 5_000 });
  const before = await title.boundingBox();
  await page.waitForTimeout(1_100);
  await expect(time).not.toHaveText("now");
  const after = await title.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((before?.width ?? 0) - (after?.width ?? 0))).toBeLessThanOrEqual(1);
});

test("overview uses a compact, aligned operations layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");

  const headingBox = await page.getByRole("heading", { name: "Overview" }).boundingBox();
  const firstMetricBox = await page.getByRole("link", { name: "Active monitors" }).boundingBox();
  const liveBox = await page.getByRole("region", { name: "Live operations" }).boundingBox();

  expect(headingBox).not.toBeNull();
  expect(firstMetricBox).not.toBeNull();
  expect(liveBox).not.toBeNull();

  const headingBottom = (headingBox?.y ?? 0) + (headingBox?.height ?? 0);
  expect((firstMetricBox?.y ?? 0) - headingBottom).toBeLessThanOrEqual(56);
  expect(liveBox?.width).toBeGreaterThan(1_000);
  await expect(page.getByText("Needs review", { exact: true }).first()).toBeVisible();
});
