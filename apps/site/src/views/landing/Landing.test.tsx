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

  it("shows a list and a record page in both themes after the config", () => {
    const html = renderToStaticMarkup(createElement(Landing));

    for (const shot of ["admin-list", "admin-record"]) {
      expect(html).toContain(`${shot}-light.png`);
      expect(html).toContain(`${shot}-dark.png`);
    }
    expect(html.indexOf("admin-list-light.png")).toBeGreaterThan(html.indexOf('id="config-title"'));
  });
});
