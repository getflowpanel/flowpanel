import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error Build tooling is executed as JavaScript and deliberately has no public types.
import * as build from "../../scripts/build-styles.mjs";
// @ts-expect-error Build tooling is executed as JavaScript and deliberately has no public types.
import * as guard from "../../scripts/class-guard.mjs";

const { isolateCss, KIT_THEME_KEYS, kitTheme, styleSourceFiles, tailwindBridge } = build;
const { strayUtilities, unprefixedSelectors } = guard;

async function strays(text: string): Promise<string[]> {
  const found: { candidate: string }[] = await strayUtilities([{ file: "card.js", text }]);
  return found.map(({ candidate }) => candidate).sort();
}

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
const KIT_PACKAGE = JSON.parse(readFileSync(resolve(HERE, "../../package.json"), "utf8")) as {
  exports: Record<string, unknown>;
};

describe("Tailwind v4 token bridge", () => {
  const bridge: string = tailwindBridge(CANONICAL);

  it("is exactly one inline @theme block", () => {
    expect(bridge.startsWith("@theme inline {")).toBe(true);
    expect(bridge.match(/@theme/g)).toHaveLength(1);
  });

  it("gives every bridge token a kit class name with the same value", () => {
    const theme = kitTheme(CANONICAL);
    expect(Object.keys(theme.color).length).toBeGreaterThan(20);
    const colors: Record<string, string> = KIT_THEME_KEYS.color;
    for (const [name, key] of Object.entries(colors)) {
      const value = theme.color[key].replace(" / <alpha-value>)", ")");
      expect(bridge).toContain(`--color-${name}: ${value};`);
    }
    expect(theme.radius.DEFAULT).toBe("var(--fp-radius)");
    expect(theme.shadow.sm).toBe("var(--fp-shadow-sm)");
  });

  it("refuses a bridge token without a kit class name", () => {
    expect(() => kitTheme("@theme inline { --color-fp-new: hsl(var(--fp-new)); }")).toThrow(
      "--color-fp-new has no kit name",
    );
  });

  it("maps radius and shadow tokens", () => {
    expect(bridge).toContain("--radius-fp: var(--fp-radius);");
    expect(bridge).toContain("--shadow-fp-sm: var(--fp-shadow-sm);");
  });

  it("is published as @flowpanel/kit/styles/tailwind.css", () => {
    expect(KIT_PACKAGE.exports["./styles/tailwind.css"]).toBe("./dist/styles/tailwind.css");
  });
});

describe("kit class prefix", () => {
  it("finds class selectors without the fp- prefix, variants and markers included", () => {
    const css = `
      .px-4, .sm\\:grid-cols-4, .group:hover .group-hover\\:fp-block { display: block }
      .fp-px-4, .sm\\:fp-grid-cols-4, .\\!-fp-mt-2, .hover\\:fp-bg-fill:hover, .fp-group, .fp-press { color: red }
      .\\[\\&_svg\\]\\:fp-size-4 svg { width: 1rem }
    `;
    expect(unprefixedSelectors(css).sort()).toEqual(["group", "px-4", "sm:grid-cols-4"]);
  });

  it("finds an unprefixed utility in kit code, so the host's rule cannot restyle it", async () => {
    const text = `
      const card = { className: "fp-rounded-lg hidden" };
      const base = cn("fp-grid sm:grid-cols-4", "-mt-2");
      const kind = "table";
    `;
    expect(await strays(text)).toEqual(["-mt-2", "hidden", "sm:grid-cols-4"]);
  });

  it("checks class lists word by word against the host's default Tailwind 3 and 4 classes", async () => {
    const text = `
      const a = cn("fp-flex hidden", open && "fp-p-2 block relative");
      const b = \`grid fp-gap-2 \${x}\`;
      const c = cn("fp-p-2 rounded-md", "shadow", wide ? "shadow-xl" : "rounded-2xl");
      const d = cn("outline-hidden wrap-break-word", { "inset-shadow-sm": on });
      const e = cva("fp-inline-flex fixed", { variants: { size: { sm: "truncate" } } });
      const tableClass = { ok: "fp-text-ok-ink", warn: "italic" };
    `;
    expect(await strays(text)).toEqual(
      [
        "block",
        "fixed",
        "hidden",
        "inset-shadow-sm",
        "italic",
        "outline-hidden",
        "relative",
        "rounded-2xl",
        "rounded-md",
        "shadow",
        "shadow-xl",
        "truncate",
        "wrap-break-word",
      ].sort(),
    );
  });

  it("leaves values, keys, comparisons and prose alone", async () => {
    const text = `
      // Not transition-colors: the ring would fade in.
      const button = cva("fp-inline-flex", {
        variants: { variant: { outline: "fp-border" } },
        defaultVariants: { variant: "outline" },
        compoundVariants: [{ variant: "outline", size: "sm", className: "fp-px-2" }],
      });
      const grid = heatmapGrid(points);
      const input = { type: "hidden", role: "group" };
      const slot = cn(kind === "table" && "fp-self-start", labels.get("block"));
      const message = \`\${name} is a table in your schema\`;
      const cell = { className: \`fp-w-\${size} fp-h-4\` };
    `;
    expect(await strays(text)).toEqual([]);
  });

  const artifact = resolve(HERE, "../../dist/styles/admin.css");
  it.runIf(existsSync(artifact))(
    "holds for the built stylesheet and the kit's built JS",
    async () => {
      expect(unprefixedSelectors(readFileSync(artifact, "utf8"))).toEqual([]);
      expect(await strayUtilities(styleSourceFiles())).toEqual([]);
    },
  );
});
