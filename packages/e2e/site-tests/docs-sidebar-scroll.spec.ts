import { expect, test } from "@playwright/test";

test("desktop documentation sidebar uses a subtle custom scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/docs/reference/drawer");

  const sidebar = page.locator("aside").filter({
    has: page.getByRole("navigation", { name: "Documentation" }),
  });
  await expect(sidebar).toBeVisible();

  const restingStyles = await sidebar.evaluate((element) => ({
    color: getComputedStyle(element).scrollbarColor,
    width: getComputedStyle(element).scrollbarWidth,
  }));
  expect(restingStyles.width).toBe("thin");
  expect(restingStyles.color).not.toBe("auto");

  const restingContrast = await sidebar.evaluate((element) => {
    const style = getComputedStyle(element);
    const thumbColor = style.scrollbarColor.match(/^(?:oklch|lab|lch|rgba?|color)\([^)]*\)/)?.[0];
    if (!thumbColor) return 0;

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) return 0;

    const backgroundColor = getComputedStyle(document.documentElement).backgroundColor;
    const sample = (foreground?: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, 1, 1);
      if (foreground) {
        context.fillStyle = foreground;
        context.fillRect(0, 0, 1, 1);
      }
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
    };
    const background = sample();
    const thumb = sample(thumbColor);
    const luminance = ([red, green, blue]: number[]) =>
      0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const backgroundLuminance = luminance(background);
    const thumbLuminance = luminance(thumb);
    return (
      (Math.max(backgroundLuminance, thumbLuminance) + 0.05) /
      (Math.min(backgroundLuminance, thumbLuminance) + 0.05)
    );
  });
  expect(restingContrast).toBeGreaterThanOrEqual(3);

  await sidebar.hover();
  await expect
    .poll(() => sidebar.evaluate((element) => getComputedStyle(element).scrollbarColor))
    .not.toBe(restingStyles.color);
});

test("desktop documentation sidebar keeps safe spacing at lg and xl", async ({ page }) => {
  for (const viewportWidth of [1024, 1280]) {
    await page.setViewportSize({ width: viewportWidth, height: 720 });
    await page.goto("/docs/reference/drawer");

    const sidebar = page.locator("aside").filter({
      has: page.getByRole("navigation", { name: "Documentation" }),
    });
    await expect(sidebar).toBeVisible();

    const spacing = await sidebar.evaluate((element) => {
      const versionLabel = Array.from(element.querySelectorAll<HTMLElement>("p")).find(
        (node) => node.textContent?.trim().toLowerCase() === "version",
      );
      const versionChip = versionLabel?.nextElementSibling as HTMLElement | null;
      const article = document.querySelector<HTMLElement>("article");
      if (!versionChip || !article) {
        return { contentGap: 0, contentWidth: 0, hasViewportOverflow: true, rightGap: 0 };
      }
      const sidebarRect = element.getBoundingClientRect();
      const versionRect = versionChip.getBoundingClientRect();
      return {
        contentGap: article.getBoundingClientRect().left - sidebarRect.right,
        contentWidth: versionRect.width,
        hasViewportOverflow: document.documentElement.scrollWidth > window.innerWidth,
        rightGap: sidebarRect.right - versionRect.right,
      };
    });
    expect(spacing.contentWidth).toBeGreaterThanOrEqual(210);
    expect(spacing.rightGap).toBeGreaterThanOrEqual(20);
    expect(spacing.contentGap).toBeGreaterThan(0);
    expect(spacing.hasViewportOverflow).toBe(false);
  }
});

test("desktop documentation sidebar scrolls independently from the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/docs/reference/drawer");
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
  ).toBe(true);

  const sidebar = page.locator("aside").filter({
    has: page.getByRole("navigation", { name: "Documentation" }),
  });
  await expect(sidebar).toBeVisible();

  const sidebarMetrics = await sidebar.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(sidebarMetrics.overflowY).toBe("auto");
  expect(sidebarMetrics.scrollHeight).toBeGreaterThan(sidebarMetrics.clientHeight);

  await sidebar.hover();
  const pageScrollBeforeWheel = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 500);

  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeWheel);
});
