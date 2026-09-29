import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Config } from "./Config";

describe("Config", () => {
  it("renders the configuration example without a nested horizontal scroll region", () => {
    const html = renderToStaticMarkup(createElement(Config));

    expect(html).toContain("flowpanel.config.ts");
    expect(html).not.toContain("overflow-x-auto");
  });
});
