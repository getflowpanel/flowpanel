import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Hero action hierarchy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps the two navigation choices separate from the quick-start command", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_URL", "https://demo.example.com/admin");

    const { Hero } = await import("./Hero");
    const html = renderToStaticMarkup(createElement(Hero));
    const actions = html.match(/<nav aria-label="Hero actions"[\s\S]*?<\/nav>/)?.[0];

    expect(actions, "the hero should expose one semantic action group").toBeDefined();
    expect(actions ?? "").toContain("Open live demo");
    expect(actions ?? "").toContain("Read the docs");
    expect(actions ?? "").not.toContain("pnpm dlx");
    expect(html).toContain('aria-label="Quick start"');
    expect(html).not.toContain(">GitHub<");
  }, 15_000);
});
