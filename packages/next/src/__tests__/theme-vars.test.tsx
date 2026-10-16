// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { contrastRatio, hslTriplet } from "../runtime/css-color";
import { normalizeAccent, ThemeVars } from "../runtime/theme-vars";

describe("any CSS colour as a token", () => {
  it("converts hex, rgb, hsl, hwb, lab, lch, oklab and oklch to the triplet tokens hold", () => {
    expect(hslTriplet("oklch(0.52 0.2 160)")).toBe("146.6 100% 26.7%");
    expect(hslTriplet("#10b981")).toBe("160.1 84.1% 39.4%");
    expect(hslTriplet("#fff")).toBe("0 0% 100%");
    expect(hslTriplet("rgb(16 185 129 / 0.5)")).toBe("160.1 84.1% 39.4%");
    expect(hslTriplet("rgba(16, 185, 129, 0.5)")).toBe("160.1 84.1% 39.4%");
    expect(hslTriplet("hwb(160 10% 20%)")).toBe("160 77.8% 45%");
    expect(hslTriplet("lab(52 -50 20)")).toMatch(/^15\d(\.\d)? 100% 28(\.\d)?%$/);
    expect(hslTriplet("oklab(0.5 0.1 -0.1)")).toBe("282.3 37.7% 43.7%");
    expect(hslTriplet("220 90% 50%")).toBe("220 90% 50%");
    expect(hslTriplet("var(--brand)")).toBeNull();
  });

  it("reads the CSS named colours", () => {
    expect(hslTriplet("rebeccapurple")).toBe("270 50% 40%");
    expect(hslTriplet("White")).toBe("0 0% 100%");
    expect(hslTriplet("notacolour")).toBeNull();
  });

  it("measures contrast as WCAG does", () => {
    expect(contrastRatio("0 0% 0%", "0 0% 100%")).toBe(21);
    expect(contrastRatio("147 100% 27%", "0 0% 100%")).toBeCloseTo(4.48, 2);
  });
});

describe("normalizeAccent", () => {
  it("passes a bare triplet through", () => {
    expect(normalizeAccent("220 90% 50%")).toBe("220 90% 50%");
  });

  it("unwraps the hsl() form people reach for first", () => {
    expect(normalizeAccent("hsl(220 90% 50%)")).toBe("220 90% 50%");
    expect(normalizeAccent("hsl(220, 90%, 50%)")).toBe("220 90% 50%");
  });

  it("drops the alpha channel, which the token has no slot for", () => {
    expect(normalizeAccent("hsl(220 90% 50% / 0.5)")).toBe("220 90% 50%");
  });
});

function styleText(theme: Parameters<typeof ThemeVars>[0]["theme"]): string | null {
  const { container } = render(<ThemeVars theme={theme} />);
  return container.querySelector("style")?.textContent ?? null;
}

describe("ThemeVars", () => {
  it("takes a shadcn oklch accent and colour tokens as they are", () => {
    const css = styleText({
      accent: "oklch(0.52 0.2 160)",
      cssVars: { "--fp-bg-1": "#ffffff", "--fp-radius": "0.5rem" },
    });
    expect(css).toContain("--fp-accent:146.6 100% 26.7%");
    expect(css).toContain("--fp-bg-1:0 0% 100%");
    expect(css).toContain("--fp-radius:0.5rem");
  });

  it("warns once in development when the accent's button text reads under 4.5:1", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    styleText({ accent: "oklch(0.6 0.2 160)" });
    styleText({ accent: "oklch(0.6 0.2 160)" });
    styleText({ accent: "222 10% 12%" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /theme\.accent "oklch\(0\.6 0\.2 160\)" .* \d\.\d\d:1/,
    );
    warn.mockRestore();
  });

  it("warns in development about a colour it cannot read, and not about one it can", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    styleText({
      accent: "var(--primary)",
      cssVars: { "--fp-bg-1": "color-mix(in srgb, red, blue)" },
    });
    styleText({
      accent: "teal",
      cssVars: {
        "--fp-radius": "0.5rem",
        "--fp-space-unit": "0.25rem",
        "--fp-table-head-h": "2.5rem",
        "--fp-scroll-fade": "1.5rem",
        "--brand-gap": "1rem",
        "fp-text-2": "slategray",
      },
    });
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((m) => m.includes("is not a colour FlowPanel can read"))).toHaveLength(
      2,
    );
    expect(messages.some((m) => m.includes('"teal"') && m.includes("not a colour"))).toBe(false);
    warn.mockRestore();
  });

  it("draws the admin dark from the host's .dark class in host mode", () => {
    const css = styleText({ mode: "host", accentDark: "220 90% 70%" });
    expect(css).toContain('html[class~="dark"] [data-flowpanel-root][data-scheme="host"]');
    expect(css).toContain('[data-flowpanel-root]:not([data-scheme="host"])');
  });

  it("emits nothing when no theme customizes the tokens", () => {
    expect(styleText(undefined)).toBeNull();
    expect(styleText({ mode: "dark" })).toBeNull();
  });

  it("writes accent only to Flowpanel roots and portals", () => {
    const css = styleText({ accent: "hsl(10 90% 50%)" });
    expect(css).toMatch(
      /^\[data-flowpanel-root\],\[data-flowpanel-portal\]\{--fp-accent:10 90% 50%;/,
    );
    expect(css).not.toContain(":root");
  });

  it("accepts cssVars with or without the leading dashes", () => {
    expect(styleText({ cssVars: { "--fp-radius": "0.25rem", "fp-bg-1": "0 0% 10%" } })).toBe(
      "[data-flowpanel-root],[data-flowpanel-portal]{--fp-radius:0.25rem;--fp-bg-1:0 0% 10%}",
    );
  });

  it("writes accentDark only to namespaced dark roots and portals", () => {
    const css = styleText({ accent: "10 90% 50%", accentDark: "hsl(10 90% 68%)" });
    expect(css).toContain("[data-flowpanel-root],[data-flowpanel-portal]{--fp-accent:10 90% 50%;");
    expect(css).toContain('html[data-flowpanel-theme="dark"] [data-flowpanel-root]');
    expect(css).toContain("--fp-accent:10 90% 68%");
    expect(css).not.toContain(":root");
  });

  it("writes cssVarsDark only to namespaced dark roots and portals", () => {
    const css = styleText({ cssVarsDark: { "--fp-text-1": "0 0% 100%", "fp-bg-1": "0 0% 10%" } });
    expect(css).toContain('html[data-flowpanel-theme="dark"] [data-flowpanel-root]');
    expect(css).toContain("--fp-text-1:0 0% 100%;--fp-bg-1:0 0% 10%");
    expect(css).not.toContain(":root");
  });

  it("refuses names and values that could break out of the rule", () => {
    expect(styleText({ cssVars: { "--fp-x': red }; body { display: none": "1" } })).toBeNull();
    expect(styleText({ cssVars: { "--fp-radius": "1rem} body{display:none" } })).toBe(
      "[data-flowpanel-root],[data-flowpanel-portal]{--fp-radius:1rem bodydisplay:none}",
    );
  });

  it("paints data in the host accent when the host sets only an accent", () => {
    const css = styleText({ accent: "142 70% 40%" }) ?? "";
    expect(css).toContain(
      "[data-flowpanel-root],[data-flowpanel-portal]{--fp-accent:142 70% 40%;--fp-data:var(--fp-accent)}",
    );
    expect(css).toMatch(/\[data-flowpanel-portal\]\{--fp-data:var\(--fp-chart-1\)\}$/);
  });

  it("paints dark data in the dark accent when the host sets one", () => {
    const css = styleText({ accentDark: "142 60% 60%" }) ?? "";
    expect(css).toContain("{--fp-accent:142 60% 60%;--fp-data:var(--fp-accent)}");
    expect(css).not.toContain("[data-flowpanel-root],[data-flowpanel-portal]{");
  });

  it("keeps a data colour the host sets itself", () => {
    const css =
      styleText({
        accent: "142 70% 40%",
        accentDark: "142 60% 60%",
        cssVars: { "--fp-data": "200 50% 40%" },
        cssVarsDark: { "fp-data": "200 50% 60%" },
      }) ?? "";
    expect(css).not.toContain("var(--fp-accent)");
    expect(css).not.toContain("var(--fp-chart-1)");
    expect(css).toContain("--fp-data:200 50% 40%");
    expect(css).toContain("--fp-data:200 50% 60%");
  });
});
