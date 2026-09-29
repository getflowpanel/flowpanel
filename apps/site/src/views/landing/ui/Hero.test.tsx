import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

vi.mock("@/shared/lib/site-config", () => ({
  siteConfig: { links: { demo: "https://demo.example.com/admin" } },
}));

describe("Hero", () => {
  it("offers the live demo as the one primary action and the docs as a text link", () => {
    const html = renderToStaticMarkup(createElement(Hero));
    const actions = html.match(/<nav aria-label="Hero actions"[\s\S]*?<\/nav>/)?.[0] ?? "";

    expect(actions).toContain('href="https://demo.example.com/admin"');
    expect(actions).toContain("Open the live demo");
    expect(actions).toContain('href="/docs"');
    expect(actions.match(/bg-\[var\(--color-ink\)\]/g)).toHaveLength(1);
  });

  it("carries no release line or upgrade link", () => {
    const html = renderToStaticMarkup(createElement(Hero));

    expect(html).not.toContain("/docs/guides/upgrade");
    expect(html).not.toMatch(/0\.3\.\d:/);
  });
});
