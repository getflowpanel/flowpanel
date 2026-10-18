import {
  DE_LABELS,
  DEFAULT_LABELS,
  ES_LABELS,
  FR_LABELS,
  PT_BR_LABELS,
  type ResolvedLabels,
  RU_LABELS,
} from "@flowpanel/kit";
import { expect, type Page, test } from "./hydration";

const PRESETS: Record<string, ResolvedLabels> = {
  "ru-RU": RU_LABELS,
  "de-DE": DE_LABELS,
  "fr-FR": FR_LABELS,
  es: ES_LABELS,
  "pt-BR": PT_BR_LABELS,
};

/** The demo's own copy that shares words with the kit's English: its layout, labels and data, never FlowPanel's. */
const HOST_TEXT = [
  "Skip to main content",
  "View on GitHub",
  "Latest market events",
  "Pages / min",
  "Open invoices",
  "Open Box",
  "Open review queue",
  "View config",
  "Live operations",
  "Resource Card Holder",
];
const HOST_WORDS = new Set(["Admin", "Account", "Pages"]);

type Tree = string | { [key: string]: Tree };

function leaves(en: Tree, own: Tree, path: string, out: Array<{ path: string; text: string }>) {
  if (typeof en === "string") {
    if (typeof own !== "string" || own !== en) out.push({ path, text: en });
    return;
  }
  for (const [key, value] of Object.entries(en)) {
    const other = typeof own === "object" ? own[key] : undefined;
    leaves(value, other ?? "", path ? `${path}.${key}` : key, out);
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const asWord = (chunk: string) => new RegExp(`(?<![A-Za-z])${escapeRegExp(chunk)}(?![A-Za-z])`);

function texts(tree: Tree): string[] {
  return typeof tree === "string" ? [tree] : Object.values(tree).flatMap(texts);
}

/** English chrome cut at its `{placeholders}`, less words the preset writes the same way ("Min."). */
function englishChunks(preset: ResolvedLabels): Array<{ path: string; chunk: string }> {
  const all: Array<{ path: string; text: string }> = [];
  const { dateRange: _dateRange, ...labels } = DEFAULT_LABELS;
  const { dateRange: _ownDateRange, ...own } = preset;
  leaves(labels as unknown as Tree, own as unknown as Tree, "", all);
  const ownTexts = texts(own as unknown as Tree);
  return all.flatMap(({ path, text }) =>
    text
      .split(/\{\w+\}/)
      .map((part) => part.trim().replace(/^[\s.,:;·—–-]+|[\s.,:;·—–-]+$/g, ""))
      .filter((part) => /[A-Za-z]{3}/.test(part) && !HOST_WORDS.has(part))
      .filter((part) => !ownTexts.some((ownText) => asWord(part).test(ownText)))
      .map((chunk) => ({ path, chunk })),
  );
}

/** What the page shows or reads out: its text and every accessible-name attribute. */
async function pageWords(page: Page): Promise<string> {
  return page.evaluate(() => {
    const attributes = ["aria-label", "placeholder", "title", "alt", "aria-description"];
    const parts = [document.title, document.body.innerText];
    for (const element of Array.from(document.querySelectorAll("*"))) {
      for (const name of attributes) {
        const value = element.getAttribute(name);
        if (value) parts.push(value);
      }
    }
    return parts.join("\n");
  });
}

async function expectNoKitEnglish(page: Page, screen: string): Promise<void> {
  const chunks = englishChunks(labelsUnderTest());
  const words = HOST_TEXT.reduce((text, host) => text.split(host).join(" "), await pageWords(page));
  const found = chunks.flatMap(({ path, chunk }) => {
    const at = asWord(chunk).exec(words)?.index;
    if (at === undefined) return [];
    const context = words.slice(Math.max(0, at - 30), at + chunk.length + 30).replace(/\s+/g, " ");
    return [`${path}: "${chunk}" in "…${context}…"`];
  });
  expect(found, `kit strings still in English on ${screen}`).toEqual([]);
}

async function firstRowId(page: Page, resource: string): Promise<string> {
  await page.goto(`/admin/${resource}`);
  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(new RegExp(`drawer=${resource}(?::|%3A)`));
  await expectNoKitEnglish(page, `${resource} drawer`);
  const id = new URL(page.url()).searchParams.get("drawer")?.split(":")[1];
  expect(id).toBeTruthy();
  return id as string;
}

/** The preset of the locale the project boots the demo under. */
function labelsUnderTest(): ResolvedLabels {
  const locale = String(test.info().project.metadata.locale);
  const labels = PRESETS[locale];
  if (!labels) throw new Error(`no label preset for ${locale}`);
  return labels;
}

test("the admin shows no kit English under the project's locale", async ({ page }) => {
  test.setTimeout(180_000);
  const labels = labelsUnderTest();
  expect(englishChunks(labels).length).toBeGreaterThan(200);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoKitEnglish(page, "overview");

  for (const resource of ["customers", "monitors", "runs", "listings", "products", "matches"]) {
    await page.goto(`/admin/${resource}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoKitEnglish(page, `${resource} list`);
  }

  await page.goto("/admin/products");
  await page.locator("tbody tr").first().getByRole("checkbox").check();
  await expectNoKitEnglish(page, "products with a selection");

  const product = await firstRowId(page, "products");
  await page.goto(`/admin/products/${product}/edit`);
  await page.getByRole("textbox", { name: "Our price" }).fill("12.345");
  await page.getByRole("button", { name: labels.actions.save }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expectNoKitEnglish(page, "product edit with an error");
  await page.getByRole("textbox", { name: "Our price" }).fill("12.34");
  await page.getByRole("button", { name: labels.actions.save }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/products/${product}$`));
  await expectNoKitEnglish(page, "product record");

  await page.goto(`/admin/products/${product}?tab=history`);
  await expect(page.locator("[data-fp-audit-event]").first()).toBeVisible();
  await expectNoKitEnglish(page, "product history");

  await page.goto("/admin/products/new");
  await expectNoKitEnglish(page, "new product");

  await page.goto("/admin/audit-log");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(labels.audit.title);
  await expectNoKitEnglish(page, "audit log");

  const customer = await firstRowId(page, "customers");
  await page.goto(`/admin/customers/${customer}`);
  await expectNoKitEnglish(page, "customer record");

  await page.goto("/admin/matches?q=zzzzzz-nothing");
  await expectNoKitEnglish(page, "empty filtered list");

  await page.goto("/admin/no-such-page");
  await expectNoKitEnglish(page, "not found");

  await page.goto("/admin/listings");
  const listingRows = page.locator("tbody tr");
  await listingRows.nth(0).getByRole("checkbox").check();
  await listingRows.nth(1).getByRole("checkbox").check();
  await page
    .getByRole("region", { name: labels.bulkBar.label })
    .getByRole("button", { name: labels.actions.delete })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: `${labels.actions.delete} (2)` })
    .click();
  await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
  await expectNoKitEnglish(page, "listings after a bulk delete");

  const clientReady = page.waitForRequest((request) =>
    request.url().includes("/api/flowpanel/stream?channel=market-activity"),
  );
  await page.goto("/admin");
  await clientReady;
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByPlaceholder(labels.palette.placeholder)).toBeVisible();
  await expectNoKitEnglish(page, "command palette");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/customers");
  await expectNoKitEnglish(page, "customers on a phone");
});
