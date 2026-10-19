import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { adminFixtureScript } from "./admin-fixture/bundle";
import type { FixtureOptions } from "./admin-fixture/entry";

const requireE2e = createRequire(join(__dirname, "../package.json"));
const { expect, test } = requireE2e("@playwright/test") as typeof import("@playwright/test");
const css = readFileSync(resolve(__dirname, "../../flowpanel/dist/styles/admin.css"), "utf8");

const DEFAULTS: FixtureOptions = {
  shell: "tabs",
  rows: 20,
  inlineActions: 0,
  rowMenu: false,
  tabs: ["Customers"],
  activeTab: 0,
  overlays: false,
  footerPx: 0,
  headerPx: 0,
};

async function mount(
  page: import("@playwright/test").Page,
  options: Partial<FixtureOptions>,
): Promise<void> {
  await page.setContent(
    `<!doctype html><html><head><style>body{margin:0}</style><style>${css}</style></head><body><div id="root"></div>
    <script>window.fixture = ${JSON.stringify({ ...DEFAULTS, ...options })}</script>
    <script>${adminFixtureScript()}</script></body></html>`,
  );
  await page.locator("[data-fp-cell], [data-fp-card]").first().waitFor();
}

test.describe("tabs shell list height", () => {
  for (const footerPx of [0, 120]) {
    test(`a list with a yes/no column fills an 800 px tall screen (host footer ${footerPx} px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 800 });
      await mount(page, { footerPx });
      await expect
        .poll(() =>
          page
            .locator("[data-flowpanel-root] > div")
            .evaluate((el) => el.style.getPropertyValue("--fp-below")),
        )
        .toBe(`${24 + footerPx}px`);
      const scroller = await page
        .locator("[data-fp-table-scroll]")
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(scroller).toBeGreaterThan(560 - footerPx);
      const overflow = await page.evaluate(() => {
        const footer = document.getElementById("host-footer");
        const end = footer
          ? footer.getBoundingClientRect().bottom
          : (document.querySelector("main")?.getBoundingClientRect().bottom ?? 0);
        return document.documentElement.scrollHeight - (end + window.scrollY);
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test("the sidebar shell under a host header fills the rest of the screen without a page scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mount(page, { shell: "sidebar", headerPx: 56 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBe(900);
  const scroller = await page
    .locator("[data-fp-table-scroll]")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(scroller).toBeLessThanOrEqual(900);
});

test.describe("phone cards with row actions", () => {
  for (const inlineActions of [1, 2]) {
    test(`${inlineActions} inline action(s) sit under the fields, which keep the card's width`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mount(page, { inlineActions, rowMenu: true, rows: 5 });
      const card = await page
        .locator("[data-fp-card]")
        .first()
        .evaluate((li) => {
          const box = (el: Element | null) => el?.getBoundingClientRect() ?? new DOMRect();
          const fields = box(li.querySelector("dl"));
          const toolbar = box(li.querySelector('[role="toolbar"]'));
          return {
            card: box(li),
            fields,
            toolbar,
            value: box(li.querySelector("dd")),
          };
        });
      expect(card.fields.width).toBeGreaterThan(card.card.width - 40);
      expect(card.toolbar.top).toBeGreaterThanOrEqual(card.fields.bottom);
      expect(card.toolbar.right).toBeLessThanOrEqual(card.card.right);
      expect(card.toolbar.left).toBeGreaterThanOrEqual(card.card.left);
      expect(card.card.height).toBeLessThan(320);
    });
  }

  test("a row menu alone stays beside the title", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(page, { rowMenu: true, rows: 5 });
    const { menu, title } = await page
      .locator("[data-fp-card]")
      .first()
      .evaluate((li) => {
        const menuBox = li.querySelector("[data-row-menu]")?.getBoundingClientRect();
        const titleBox = li.querySelector(".fp-text-base")?.getBoundingClientRect();
        return { menu: menuBox?.top ?? -1, title: titleBox?.top ?? -2 };
      });
    expect(Math.abs(menu - title)).toBeLessThan(8);
  });
});

test("the phone tab strip starts with its first tab and keeps the current one in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tabs = ["Overview", "Marketplaces", "Customers", "Monitors", "Runs", "Audit log"];
  for (const activeTab of [0, 2, 5]) {
    await mount(page, { tabs, activeTab, rows: 3 });
    const nav = page.locator("nav[data-flowpanel-nav]");
    await expect(nav.getByRole("button", { name: "More" })).toBeVisible();
    const shown = await nav.locator("li:visible").evaluateAll((items) =>
      items.map((li) => {
        const box = li.getBoundingClientRect();
        return { text: li.textContent, left: box.left, right: box.right };
      }),
    );
    expect(shown[0]?.text).toBe("Overview");
    expect(shown[0]?.left ?? -1).toBeGreaterThanOrEqual(0);
    expect(shown.map((tab) => tab.text)).toContain(tabs[activeTab]);
    const more = await nav.getByRole("button", { name: "More" }).boundingBox();
    for (const tab of shown) expect(tab.right).toBeLessThanOrEqual((more?.x ?? 0) + 1);
  }
});

test.describe("menus, popovers and selects that load on first use", () => {
  test("open from a click and from the keyboard, and work once open", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mount(page, { overlays: true, rows: 3 });
    const plan = page.getByRole("combobox", { name: "Plan" });
    await expect(plan).toHaveAttribute("aria-expanded", "false");
    await plan.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Pro" }).click();
    await expect(plan).toContainText("Pro");

    await page.getByRole("button", { name: "All" }).click();
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    await popover.getByText("Active").click();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Pick a customer" }).click();
    await expect(page.getByRole("listbox", { name: "Customers" })).toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute("data-submitted", "true");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Columns" }).click();
    const email = page.getByRole("menuitemcheckbox", { name: "Email" });
    await expect(email).toBeVisible();
    await email.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("a focused trigger keeps focus when the menu code arrives", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mount(page, { overlays: true, rows: 3 });
    const columns = page.getByRole("button", { name: "Columns" });
    await columns.focus();
    await expect(columns).toHaveAttribute("aria-expanded", "false");
    await columns.hover();
    await expect(columns).toHaveAttribute("id", /radix/);
    await expect(columns).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
  });
});
