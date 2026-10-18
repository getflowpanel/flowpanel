import { choosePersona, expect, test } from "./hydration";

test("@cross-browser release shell is responsive and role-aware", async ({ page, isMobile }) => {
  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("hydrated but some attributes")) {
      hydrationWarnings.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("price intelligence");
  await expect(page.getByRole("link", { name: "Open admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source" })).toBeVisible();
  await expect(page.getByRole("link", { name: /star/i })).toHaveCount(0);

  if (isMobile) {
    for (const control of [
      page.getByRole("button", { name: "admin", exact: true }),
      page.getByRole("button", { name: "support", exact: true }),
      page.getByRole("link", { name: "View on GitHub" }),
    ]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }

  const hasHorizontalOverflow = await page.evaluate(
    "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1",
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.goto("/admin");
  await expect(page.getByText("ScrapeAI", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "admin", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "support", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View on GitHub" })).toBeVisible();
  await expect(page.getByText("Demo guide", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Download brief", { exact: true })).toHaveCount(0);

  if (isMobile) {
    const accountBox = await page.getByRole("button", { name: "Account menu" }).boundingBox();
    expect(accountBox?.height).toBeGreaterThanOrEqual(44);
  }

  await choosePersona(page, "support");
  await page.reload();
  // Pressed once more only while it still reads closed, so an open menu is never clicked shut.
  const account = page.getByRole("button", { name: "Account menu" });
  await expect(async () => {
    if ((await account.getAttribute("aria-expanded")) !== "true") await account.click();
    await expect(page.getByText("Role: support")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  expect(hydrationWarnings).toEqual([]);
});

test("demo persona makes the field-level policy visible", async ({ page }) => {
  await page.goto("/admin");

  await choosePersona(page, "support");
  await page.goto("/admin/products");
  await expect(page.getByRole("columnheader", { name: "Our price" })).toHaveCount(0);
  await page.getByRole("row").filter({ hasText: "NWA-APP2-USB-C" }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  const detail = drawer.getByRole("tabpanel", { name: "Detail" });
  await expect(detail.getByText("Product", { exact: true })).toBeVisible();
  await expect(detail.getByText("Our price", { exact: true })).toHaveCount(0);
  // The drawer is modal: the persona switch behind it is unreachable until it closes.
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  await choosePersona(page, "admin");
  await page.goto("/admin/products");
  await expect(page.getByRole("columnheader", { name: "Our price" })).toBeVisible();
});

test("the overview, a list and a record page share one 1600 px frame and header edge, the record's aside 25rem", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  const edges = () =>
    page.evaluate(() => {
      const inner = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return [
          Math.round(box.left + Number.parseFloat(style.paddingLeft)),
          Math.round(box.right - Number.parseFloat(style.paddingRight)),
        ];
      };
      const heading = document.querySelector("main h1")?.getBoundingClientRect();
      return {
        main: inner("main"),
        tabs: inner("nav[data-flowpanel-nav] > div"),
        heading: heading ? Math.round(heading.left) : null,
      };
    });

  await page.goto("/admin/customers");
  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/drawer=customers(?::|%3A)/);
  const customer = new URL(page.url()).searchParams.get("drawer")?.split(":")[1];
  expect(customer).toBeTruthy();

  for (const path of ["/admin", "/admin/listings", `/admin/customers/${customer}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await edges(), path).toEqual({ main: [160, 1760], tabs: [160, 1760], heading: 160 });
  }
  await expect(page).toHaveURL(new RegExp(`/admin/customers/${customer}$`));
  const record = await page.locator("main [data-record-layout]").first().boundingBox();
  expect(record).not.toBeNull();
  expect(Math.round(record?.x ?? 0)).toBe(160);
  expect(Math.round((record?.x ?? 0) + (record?.width ?? 0))).toBe(1760);
  const aside = await page.locator("main [data-record-layout] > aside").boundingBox();
  expect(Math.round(aside?.width ?? 0)).toBe(25 * 16);
});
