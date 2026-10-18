import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Config } from "./Config";

describe("Config", () => {
  it("keeps every config line intact and lets the keyboard scroll the block sideways on narrow screens", () => {
    const html = renderToStaticMarkup(createElement(Config));
    const pre = html.match(/<pre[^>]*>/)?.[0] ?? "";
    const classes = pre.match(/class="([^"]*)"/)?.[1]?.split(" ") ?? [];

    expect(html).toContain("flowpanel.config.ts");
    expect(classes).toContain("whitespace-pre");
    expect(classes).toContain("overflow-x-auto");
    expect(classes).not.toContain("whitespace-pre-wrap");
    expect(pre).toContain('tabindex="0"');
  });
});
