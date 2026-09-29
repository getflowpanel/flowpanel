import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Landing } from "./Landing";

describe("Landing", () => {
  it("goes from what it is to the config, what is included and how to start", () => {
    const html = renderToStaticMarkup(createElement(Landing));
    const order = ["hero-title", "config-title", "included-title", "start-title"].map((id) =>
      html.indexOf(`id="${id}"`),
    );

    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
