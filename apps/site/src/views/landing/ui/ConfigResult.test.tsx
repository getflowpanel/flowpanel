import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfigResult } from "./ConfigResult";

describe("ConfigResult", () => {
  it("renders the configuration example without a nested horizontal scroll region", () => {
    const html = renderToStaticMarkup(createElement(ConfigResult));

    expect(html).not.toContain("overflow-x-auto");
  });
});
