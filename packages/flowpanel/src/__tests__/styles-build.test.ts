import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error Build tooling is executed as JavaScript and deliberately has no public types.
import { isolateCss, tailwindBridge } from "../../scripts/build-styles.mjs";

describe("precompiled admin stylesheet isolation", () => {
  it("qualifies the styled subject of complex selectors, including portal roots and pseudo-elements", () => {
    const css = isolateCss(`
      .group:hover .group-hover\\:block, .before\\:block::before { display: block }
      [data-flowpanel-portal] { padding: 1rem }
    `);

    expect(css).toContain(
      ".group-hover\\:block:where([data-flowpanel-root], [data-flowpanel-root] *, [data-flowpanel-portal], [data-flowpanel-portal] *)",
    );
    expect(css).toContain(
      ".before\\:block:where([data-flowpanel-root], [data-flowpanel-root] *, [data-flowpanel-portal], [data-flowpanel-portal] *)::before",
    );
    expect(css).toContain(
      "[data-flowpanel-portal]:where([data-flowpanel-root], [data-flowpanel-root] *, [data-flowpanel-portal], [data-flowpanel-portal] *)",
    );
  });

  it("keeps list-formatting whitespace out of root and portal pseudo-element subjects", () => {
    const css = isolateCss(`
      *,
      ::before,
      ::after,
      [data-flowpanel-root]::before,
      [data-flowpanel-portal]::after,
      .parent ::before,
      .parent > .child::after { box-sizing: border-box }
    `);

    const subject =
      ":where([data-flowpanel-root], [data-flowpanel-root] *, [data-flowpanel-portal], [data-flowpanel-portal] *)";
    expect(css).toContain(`${subject}::before`);
    expect(css).toContain(`${subject}::after`);
    expect(css).not.toContain(`${subject} ::before`);
    expect(css).not.toContain(`${subject} ::after`);
    expect(css).not.toContain(`${subject}\n::before`);
    expect(css).not.toContain(`${subject}\n::after`);
    expect(css).toContain(`.parent ${subject}::before`);
    expect(css).toContain(`.parent > .child${subject}::after`);

    const inline = isolateCss("*, ::before, ::after { box-sizing: border-box }");
    expect(inline).not.toContain(`${subject} ::before`);
    expect(inline).not.toContain(`${subject} ::after`);
  });

  it("namespaces compiler internals and generated keyframes without touching FlowPanel or Radix variables", () => {
    const css = isolateCss(`
      .animate-pulse { --tw-ring-color: red; animation: pulse 1s linear }
      .radix { --radix-popover-content-transform-origin: center; color: var(--tw-ring-color) }
      @property --tw-ring-color { syntax: "*"; inherits: false; initial-value: red }
      @keyframes pulse { to { opacity: 0 } }
      @keyframes fp-shimmer { to { opacity: 1 } }
    `);

    expect(css).toContain("--fp-tw-ring-color");
    expect(css).not.toContain("--tw-ring-color");
    expect(css).toContain("--radix-popover-content-transform-origin");
    expect(css).toContain("@keyframes fp-tw-pulse");
    expect(css).toContain("animation: fp-tw-pulse 1s linear");
    expect(css).toContain("@keyframes fp-shimmer");
  });

  it("leaves harmless empty at-rules alone and rejects global selectors", () => {
    expect(() => isolateCss("@media screen {}")).not.toThrow();
    expect(() => isolateCss(":root { --spacing: 1rem }")).toThrow("unsafe global selector");
  });
});

const HERE = dirname(fileURLToPath(import.meta.url));
const CANONICAL = readFileSync(resolve(HERE, "../../../react/src/styles/admin.css"), "utf8");
const BUILD_SCRIPT = readFileSync(resolve(HERE, "../../scripts/build-styles.mjs"), "utf8");
const KIT_PACKAGE = JSON.parse(readFileSync(resolve(HERE, "../../package.json"), "utf8")) as {
  exports: Record<string, unknown>;
};

describe("Tailwind v4 token bridge", () => {
  const bridge: string = tailwindBridge(CANONICAL);

  it("is exactly one inline @theme block", () => {
    expect(bridge.startsWith("@theme inline {")).toBe(true);
    expect(bridge.match(/@theme/g)).toHaveLength(1);
  });

  it("maps every colour token the precompiled stylesheet knows", () => {
    const colours = [...BUILD_SCRIPT.matchAll(/fpColor\("([\w-]+)"\)/g)].map(([, name]) => name);
    expect(colours.length).toBeGreaterThan(20);
    for (const name of colours) expect(bridge).toContain(`hsl(var(--fp-${name}))`);
  });

  it("maps radius and shadow tokens", () => {
    expect(bridge).toContain("--radius-fp: var(--fp-radius);");
    expect(bridge).toContain("--shadow-fp-sm: var(--fp-shadow-sm);");
  });

  it("is published as @flowpanel/kit/styles/tailwind.css", () => {
    expect(KIT_PACKAGE.exports["./styles/tailwind.css"]).toBe("./dist/styles/tailwind.css");
  });
});
