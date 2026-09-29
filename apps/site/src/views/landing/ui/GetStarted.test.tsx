import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GetStarted } from "./GetStarted";

describe("GetStarted", () => {
  it("shows the install command, the guide and both runnable examples", () => {
    const html = renderToStaticMarkup(createElement(GetStarted));

    expect(html).toContain("pnpm dlx @flowpanel/cli init");
    expect(html).toContain('href="/docs/introduction/getting-started"');
    expect(html).toContain("examples/ai-scraper");
    expect(html).toContain("examples/with-clerk");
  });
});
