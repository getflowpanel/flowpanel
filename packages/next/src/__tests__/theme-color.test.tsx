// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_COLOR, ThemeColor } from "../runtime/theme-vars";

afterEach(cleanup);

function metas(theme: Parameters<typeof ThemeColor>[0]["theme"]) {
  render(<ThemeColor theme={theme} />);
  return [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
    media: meta.getAttribute("media"),
    content: meta.getAttribute("content"),
    scheme: meta.getAttribute("data-flowpanel"),
  }));
}

describe("the browser chrome colour", () => {
  it("follows the page colour of each scheme", () => {
    expect(metas(undefined)).toEqual([
      {
        media: "(prefers-color-scheme: light)",
        content: `hsl(${PAGE_COLOR.light})`,
        scheme: "light",
      },
      { media: "(prefers-color-scheme: dark)", content: `hsl(${PAGE_COLOR.dark})`, scheme: "dark" },
    ]);
  });

  it("takes a host's page colour", () => {
    const [light, dark] = metas({
      cssVars: { "--fp-bg-2": "40 20% 96%" },
      cssVarsDark: { "fp-bg-2": "hsl(40 10% 8%)" },
    });
    expect(light?.content).toBe("hsl(40 20% 96%)");
    expect(dark?.content).toBe("hsl(40 10% 8%)");
  });

  it("starts in the admin's default scheme when it sets one", () => {
    const [light, dark] = metas({ mode: "dark" });
    expect(light?.media).toBe("not all");
    expect(dark?.media).toBe("all");
  });

  it("reads a page colour written as any CSS colour", () => {
    const [light] = metas({ cssVars: { "--fp-bg-2": "#fafafa" } });
    expect(light?.content).toBe("hsl(0 0% 98%)");
  });

  it("passes a page colour it cannot read through as it is", () => {
    const [light] = metas({ cssVars: { "--fp-bg-2": "var(--page)" } });
    expect(light?.content).toBe("var(--page)");
  });

  it("matches the stylesheet's own page tokens", () => {
    const css = readFileSync(resolve(__dirname, "../../../react/src/styles/admin.css"), "utf8");
    const pages = [...css.matchAll(/--fp-bg-2:\s*([^;]+);/g)].map((match) => match[1]);
    expect(pages.slice(0, 2)).toEqual([PAGE_COLOR.light, PAGE_COLOR.dark]);
  });
});
