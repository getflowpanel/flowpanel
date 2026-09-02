import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

async function renderGuide(role: "admin" | "support") {
  const { DemoPersonaGuide } = await import("../DemoPersonaGuide");
  return renderToStaticMarkup(React.createElement(DemoPersonaGuide, { role }));
}

describe("ScrapeAI demo personas", () => {
  it("presents the demo context, role switcher, and GitHub exit in one banner", async () => {
    const html = await renderGuide("admin");

    expect(html).toContain('aria-label="FlowPanel demo"');
    expect(html).toContain("FlowPanel demo");
    expect(html).toContain('aria-label="Demo persona"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('href="https://github.com/getflowpanel/flowpanel"');
    expect(html).toContain('aria-label="View on GitHub"');
  });

  it("marks support as the selected demo persona", async () => {
    const html = await renderGuide("support");

    expect(html).toContain('aria-label="Demo persona"');
    expect(html).toContain('value="support"');
    expect(html).toContain('aria-pressed="true"');
  });
});
