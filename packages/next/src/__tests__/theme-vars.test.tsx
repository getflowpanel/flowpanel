// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { normalizeAccent, ThemeVars } from "../runtime/theme-vars";

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
    expect(css).toMatch(/\[data-theme="dark"\]\{--fp-data:var\(--fp-chart-1\)\}$/);
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
