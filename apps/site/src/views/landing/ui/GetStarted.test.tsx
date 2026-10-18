import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GetStarted } from "./GetStarted";

describe("GetStarted", () => {
  it("shows the install command, the guides, the ORM pages and both runnable examples", () => {
    const html = renderToStaticMarkup(createElement(GetStarted));

    expect(html).toContain("pnpm dlx @flowpanel/cli init");
    expect(html).toContain('href="/docs/introduction/getting-started"');
    expect(html).toContain("examples/ai-scraper");
    expect(html).toContain("examples/with-clerk");
    expect(html).toContain("a small admin behind Clerk");
    expect(html).toContain('href="/docs/guides/upgrade"');
    expect(html).toContain('href="/docs/introduction/drizzle"');
    expect(html).toContain('href="/docs/introduction/prisma"');
    expect(html).toContain('href="/docs/introduction/why-flowpanel"');
  });
});
