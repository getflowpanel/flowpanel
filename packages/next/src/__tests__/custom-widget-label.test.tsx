import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { custom } from "@flowpanel/core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ServerCard } from "../runtime/_server-card";
import { renderWidget } from "../runtime/render-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const config = { resourcesByName: new Map(), __resolved: true } as unknown as ResolvedAdminConfig;
const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

function findProps(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findProps(child, target);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === target) return el.props;
  return findProps(el.props.children, target);
}

describe("a custom widget's label", () => {
  it("titles the frame", async () => {
    const node = await renderWidget(
      custom(() => null, {}, { label: "Конвейер" }),
      fakeWidgetContext(),
      config,
      reqCtx,
    );
    expect(findProps(node, ServerCard)?.label).toBe("Конвейер");
  });

  it("renders as the card's header above the content", () => {
    const card = ServerCard({ label: "Конвейер", children: "body" });
    const [header, body] = (card.props as { children: ReactElement<{ children: ReactNode }>[] })
      .children;
    expect(header?.props.children).toBe("Конвейер");
    expect(body?.props.children).toBe("body");
  });
});
