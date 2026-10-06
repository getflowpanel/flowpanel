import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { bars } from "@flowpanel/core";
import { BarsCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderWidget } from "../runtime/render-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const config = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  pagesByPath: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

function barsProps(tree: ReactNode): Record<string, unknown> | undefined {
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === BarsCard) return el.props;
  const children = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
  return children.map(barsProps).find((found) => found !== undefined);
}

describe("bars widget shares and changes", () => {
  it("hands the card share, goodWhen and each row's previous value", async () => {
    const widget = bars({
      share: true,
      goodWhen: "down",
      query: async () => [{ label: "kwork", value: 3, previous: 1 }],
    });
    const props = barsProps(await renderWidget(widget, fakeWidgetContext(), config, reqCtx));
    expect(props).toMatchObject({
      share: true,
      goodWhen: "down",
      rows: [{ label: "kwork", value: 3, previous: 1 }],
    });
  });
});
