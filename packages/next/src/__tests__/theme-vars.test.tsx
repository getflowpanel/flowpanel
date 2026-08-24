// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { normalizeAccent, ThemeVars } from "../runtime/theme-vars.js";

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
    expect(styleText({ accent: "hsl(10 90% 50%)" })).toBe(
      "[data-flowpanel-root],[data-flowpanel-portal]{--fp-accent:10 90% 50%}",
    );
  });

  it("accepts cssVars with or without the leading dashes", () => {
    expect(styleText({ cssVars: { "--fp-radius": "0.25rem", "fp-bg-1": "0 0% 10%" } })).toBe(
      "[data-flowpanel-root],[data-flowpanel-portal]{--fp-radius:0.25rem;--fp-bg-1:0 0% 10%}",
    );
  });

  it("writes accentDark only to namespaced dark roots and portals", () => {
    const css = styleText({ accent: "10 90% 50%", accentDark: "hsl(10 90% 68%)" });
    expect(css).toContain("[data-flowpanel-root],[data-flowpanel-portal]{--fp-accent:10 90% 50%}");
    expect(css).toContain('html[data-flowpanel-theme="dark"] [data-flowpanel-root]');
    expect(css).toContain("--fp-accent:10 90% 68%");
    expect(css).not.toContain(":root");
  });

  it("refuses names and values that could break out of the rule", () => {
    expect(styleText({ cssVars: { "--fp-x': red }; body { display: none": "1" } })).toBeNull();
    expect(styleText({ cssVars: { "--fp-radius": "1rem} body{display:none" } })).toBe(
      "[data-flowpanel-root],[data-flowpanel-portal]{--fp-radius:1rem bodydisplay:none}",
    );
  });
});
