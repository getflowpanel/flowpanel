import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const requireE2e = createRequire(join(__dirname, "../package.json"));
const { expect, test } = requireE2e("@playwright/test") as typeof import("@playwright/test");
const requireCli = createRequire(join(__dirname, "../../cli/package.json"));
const postcss = requireCli("postcss") as (plugins: unknown[]) => {
  process(css: string, opts: { from: string }): Promise<{ css: string }>;
};
const tailwindV4 = requireCli("@tailwindcss/postcss") as (opts: { base: string }) => unknown;
const tailwindV4Dir = dirname(requireCli.resolve("tailwindcss/package.json"));
const root = resolve(__dirname, "../../..");
const artifact = join(root, "packages/flowpanel/dist/styles/admin.css");

const utilitySource = [
  "bg-fp-bg-1",
  "border",
  "border-fp-border-1",
  "grid",
  "grid-cols-1",
  "h-full",
  "mt-12",
  "p-4",
  "rounded-fp-lg",
  "ring-2",
  "ring-fp-focus/40",
  "-translate-x-1",
  "rotate-3",
  "backdrop-blur-md",
  "backdrop-blur-[2px]",
  "sm:grid-cols-3",
].join(" ");

function write(file: string, source: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
}

async function legacyCss(): Promise<{ css: string; dispose: () => void }> {
  const fixture = mkdtempSync(join(tmpdir(), "fp-legacy-css-"));
  mkdirSync(join(fixture, "node_modules"), { recursive: true });
  symlinkSync(tailwindV4Dir, join(fixture, "node_modules/tailwindcss"));
  write(join(fixture, "node_modules/@flowpanel/react/dist/presentation.mjs"), utilitySource);
  const cssPath = join(fixture, "styles/admin.css");
  const source =
    `@import "tailwindcss";\n@theme { --spacing: .25rem; --radius-md: .375rem; }\n@source "../node_modules/@flowpanel/react/dist";\n${readFileSync(
      join(root, "packages/react/src/styles/admin.css"),
      "utf8",
    )}`.replace("nav[data-flowpanel-nav]", 'nav[aria-label="Admin"]');
  write(cssPath, source);
  const css = (await postcss([tailwindV4({ base: fixture })]).process(source, { from: cssPath }))
    .css;
  return { css, dispose: () => rmSync(fixture, { recursive: true, force: true }) };
}

function precompiledCss(): string {
  return readFileSync(artifact, "utf8");
}

const hostCss = `
  #host .custom-heading { font-size: 32px; font-weight: 700; }
  #host a { color: rgb(1, 2, 3); text-decoration-line: underline; }
  #host input { border: 2px inset rgb(4, 5, 6); padding: 5px; }
  #host button { border: 3px outset rgb(7, 8, 9); padding: 6px; }
  #host .custom-list { list-style-type: square; padding-left: 40px; }
  #host .border-marker { box-sizing: content-box; border: 7px dotted rgb(10, 11, 12); }
  :root { --spacing: .5rem; --radius-md: 1rem; }
  #host-theme .p-4 { padding: calc(var(--spacing) * 4); }
  #host-theme .rounded-md { border-radius: var(--radius-md); }
`;

function pageMarkup(css: string, legacy = false): string {
  const cards = execFileSync(
    process.execPath,
    [
      "--import",
      requireCli.resolve("tsx"),
      join(__dirname, "render-flowpanel-fixture.tsx"),
      ...(legacy ? ["--legacy"] : []),
    ],
    { encoding: "utf8" },
  );
  const nonMetricWidgets = execFileSync(
    process.execPath,
    [
      "--import",
      requireCli.resolve("tsx"),
      join(__dirname, "render-flowpanel-fixture.tsx"),
      "--non-metrics",
    ],
    { encoding: "utf8" },
  );
  return `<style>${hostCss}</style><style>${css}</style>
    <section id="host">
      <h1 id="ua-heading">Host heading</h1><h1 class="custom-heading">Custom heading</h1><a href="#host-link">Host link</a><input value="host input"><button>Host button</button>
      <ul id="ua-list"><li>Host list</li></ul><ul class="custom-list"><li>Custom list</li></ul><div class="border-marker">Host border</div>
      <div id="host-theme"><div id="host-theme-marker" class="p-4 rounded-md">Host Tailwind theme</div></div>
    </section>
    <main data-flowpanel-root>
      <nav data-flowpanel-nav aria-label="Управление"><a href="#nav">Настройки</a></nav>
      <button id="admin-button" class="border border-fp-border-1 p-4">Open</button>
      <div id="utility-probe" class="mt-12 ring-2 ring-fp-focus/40 -translate-x-1/2 -translate-y-1/2">Probe</div>
      <div id="backdrop-probe" class="backdrop-blur-md">Backdrop</div>
      <div id="metrics" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">${cards}</div>
      <div id="non-metrics" class="grid grid-cols-3">${nonMetricWidgets}</div>
    </main>
    <aside data-flowpanel-portal class="border border-fp-border-1 p-4" id="portal-root"><button id="portal-button" class="border border-fp-border-1 p-4">Portal</button></aside>
    <script>document.querySelector('#admin-button').addEventListener('click', () => document.body.dataset.clicked = 'true')</script>`;
}

async function hostPresentation(
  page: import("@playwright/test").Page,
): Promise<Record<string, string>> {
  return page.locator("#host").evaluate((host) => {
    const pick = (selector: string) => {
      const element = host.querySelector(selector);
      if (!element) throw new Error(`Missing host marker: ${selector}`);
      return getComputedStyle(element);
    };
    return {
      headingSize: pick("#ua-heading").fontSize,
      headingWeight: pick("#ua-heading").fontWeight,
      headingMargin: pick("#ua-heading").marginTop,
      linkDecoration: pick("a").textDecorationLine,
      inputBorder: pick("input").borderTopWidth,
      buttonBorder: pick("button").borderTopWidth,
      listMarker: pick(".custom-list").listStyleType,
      listPadding: pick(".custom-list").paddingLeft,
      boxSizing: pick(".border-marker").boxSizing,
      borderWidth: pick(".border-marker").borderTopWidth,
      listDefault: pick("#ua-list").listStyleType,
      themePadding: pick("#host-theme-marker").paddingTop,
      themeRadius: pick("#host-theme-marker").borderTopLeftRadius,
    };
  });
}

test("RED: legacy global Preflight, tokens, and English nav selector disturb the host", async ({
  page,
}) => {
  const { css, dispose } = await legacyCss();
  try {
    await page.setContent(pageMarkup("", true));
    const before = await hostPresentation(page);
    await page.addStyleTag({ content: css });
    const after = await hostPresentation(page);
    expect(after.headingSize).not.toBe(before.headingSize);
    await page.getByRole("link", { name: "Настройки" }).focus();
    expect(
      await page
        .getByRole("link", { name: "Настройки" })
        .evaluate((el) => getComputedStyle(el).outlineWidth),
    ).not.toBe("2px");
    await page.setViewportSize({ width: 1280, height: 720 });
    const heights = await page
      .locator("#metrics [data-tone]")
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
    expect(new Set(heights).size).toBeGreaterThan(1);
  } finally {
    dispose();
  }
});

for (const hostVersion of ["v3", "v4"] as const) {
  test(`${hostVersion}: precompiled CSS needs no host Tailwind and preserves host presentation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.setContent(pageMarkup(""));
    const before = await hostPresentation(page);
    await page.addStyleTag({ content: precompiledCss() });
    expect(await hostPresentation(page)).toEqual(before);
    const nav = page.getByRole("link", { name: "Настройки" });
    await nav.focus();
    await expect(nav).toBeFocused();
    expect(await nav.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe("2px");
    await page.locator("#admin-button").click();
    await expect(page.locator("body")).toHaveAttribute("data-clicked", "true");
    expect(
      await page.locator("#portal-root").evaluate((el) => getComputedStyle(el).borderTopStyle),
    ).toBe("solid");
    expect(
      await page.locator("#portal-root").evaluate((el) => getComputedStyle(el).paddingTop),
    ).toBe("16px");
    const transform = await page.locator("#utility-probe").evaluate((el) => {
      const style = getComputedStyle(el);
      return { transform: style.transform, translate: style.translate };
    });
    expect(transform.transform !== "none" || transform.translate !== "none").toBe(true);
    expect(
      await page.locator("#utility-probe").evaluate((el) => getComputedStyle(el).boxShadow),
    ).not.toBe("none");
    expect(
      await page.locator("#backdrop-probe").evaluate((el) => getComputedStyle(el).backdropFilter),
    ).not.toBe("none");
    const desktopHeights = await page
      .locator("#metrics [data-tone]")
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
    expect(new Set(desktopHeights).size).toBe(1);
    const metricRects = await page.locator("#metrics > *").evaluateAll((slots) =>
      slots.map((slot) => {
        const card = slot.querySelector("[data-tone]");
        const drilldown = slot.querySelector("a");
        if (!card) throw new Error("Missing rendered metric card");
        return {
          slotWidth: slot.getBoundingClientRect().width,
          cardWidth: card.getBoundingClientRect().width,
          drilldownWidth: drilldown?.getBoundingClientRect().width,
        };
      }),
    );
    for (const rect of metricRects) {
      expect(rect.cardWidth).toBeCloseTo(rect.slotWidth, 2);
      if (rect.drilldownWidth !== undefined) {
        expect(rect.drilldownWidth).toBeCloseTo(rect.slotWidth, 2);
      }
    }
    const nonMetric = await page.locator("#non-metrics").evaluate((container) => {
      const slot = (id: string) => {
        const element = container.querySelector<HTMLElement>(`#${id}`);
        if (!element) throw new Error(`Missing ${id}`);
        return getComputedStyle(element).display;
      };
      const first = container.querySelector<HTMLElement>("#custom-first");
      const second = container.querySelector<HTMLElement>("#custom-second");
      if (!first || !second) throw new Error("Missing unframed custom fragment siblings");
      return {
        table: slot("table-slot"),
        chart: slot("chart-slot"),
        custom: slot("custom-slot"),
        first: first.getBoundingClientRect(),
        second: second.getBoundingClientRect(),
      };
    });
    expect(nonMetric).toMatchObject({ table: "block", chart: "block", custom: "block" });
    expect(nonMetric.second.top).toBeGreaterThan(nonMetric.first.top);
    expect(nonMetric.second.left).toBeCloseTo(nonMetric.first.left, 2);
    await page.setViewportSize({ width: 375, height: 720 });
    const tops = await page
      .locator("#metrics > *")
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(3);
    await page.locator('a[href="#metric-a"]').click();
    await expect(page).toHaveURL(/#metric-a$/);
  });
}
