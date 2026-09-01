import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

vi.mock("@/shared/lib/site-config", () => ({
  siteConfig: { links: { demo: "https://demo.example.com/admin" } },
}));

describe("Hero action hierarchy", () => {
  it("keeps the two navigation choices separate from the quick-start command", () => {
    const html = renderToStaticMarkup(createElement(Hero));
    const actions = html.match(/<nav aria-label="Hero actions"[\s\S]*?<\/nav>/)?.[0];

    expect(actions, "the hero should expose one semantic action group").toBeDefined();
    expect(actions ?? "").toContain("Open live demo");
    expect(actions ?? "").toContain("Read the docs");
    expect(actions ?? "").not.toContain("pnpm dlx");
    expect(html).toContain('aria-label="Quick start"');
    const quickStart = html.match(/<[^>]+aria-label="Quick start"[^>]*>/)?.[0];
    expect(quickStart).toContain("min-w-0");
    expect(quickStart).toContain("w-full");
    expect(quickStart).toContain("max-w-[640px]");
    expect(html).not.toContain(">GitHub<");
  });
});
