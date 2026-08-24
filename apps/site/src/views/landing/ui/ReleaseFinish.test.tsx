import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfigResult } from "./ConfigResult";
import { ReadyToShip } from "./ReadyToShip";

describe("Landing release finish", () => {
  it("renders the configuration example without a nested horizontal scroll region", () => {
    const html = renderToStaticMarkup(createElement(ConfigResult));

    expect(html).not.toContain("overflow-x-auto");
  });

  it("offers one focused installation path without repeating repository promotion", () => {
    const html = renderToStaticMarkup(createElement(ReadyToShip));
    const links = html.match(/<a\b/g) ?? [];

    expect(links).toHaveLength(1);
    expect(html).toContain('href="/docs/introduction/getting-started"');
    expect(html).not.toContain("github.com");
  });
});
