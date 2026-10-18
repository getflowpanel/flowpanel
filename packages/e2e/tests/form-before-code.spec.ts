import { expect, type Page, test } from "@playwright/test";

/** Holds every script the page did not name in its HTML, the form's code among them, until the test lets it through. */
async function holdLateScripts(page: Page, path: string): Promise<() => void> {
  const html = await (await page.request.get(path)).text();
  const chunkOf = (text: string) => decodeURIComponent(text).replace(/^.*?static\/chunks\//, "");
  const named = new Set((html.match(/static\/chunks\/[^"'\s\\]+?\.js/g) ?? []).map(chunkOf));
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/chunks/**", async (route) => {
    const chunk = chunkOf(new URL(route.request().url()).pathname);
    if (chunk.endsWith(".js") && !named.has(chunk)) await gate;
    await route.continue();
  });
  return release;
}

test("a form takes no input before its code runs, then keeps everything typed", async ({
  page,
}) => {
  const release = await holdLateScripts(page, "/admin/products/new");
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/admin/products/new", { waitUntil: "domcontentloaded" });

  const form = page.locator("form").filter({ has: page.getByLabel("Product") });
  const product = page.getByLabel("Product");
  await expect(form).toHaveAttribute("aria-busy", "true");
  await expect(product).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Category")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();

  await product.click();
  await page.keyboard.type("Typed too early");
  await page.keyboard.press("Enter");
  await expect(product).toHaveValue("");
  expect(posts).toEqual([]);
  await expect(page).toHaveURL(/\/admin\/products\/new$/);

  release();
  await expect(form).not.toHaveAttribute("aria-busy", "true");
  await expect(product).toBeEditable();
  await product.fill("Kept title");
  await page.getByLabel("SKU").fill("KEPT-1");
  await page.getByLabel("Category").selectOption("Headphones");
  await expect(product).toHaveValue("Kept title");
  await expect(page.getByLabel("SKU")).toHaveValue("KEPT-1");
});
