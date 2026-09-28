import { metric, related, stat, table } from "@flowpanel/core";
import { DetailTabsClient, RelatedTabTable } from "@flowpanel/next/client";
import { MetricCard, StatCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { findAll, listQueries, renderDetail } from "./detail-fixture";

type Row = Record<string, unknown>;
type Tabs = { tabs: { key: string; label: string; content: ReactNode }[] };

function order(tree: ReactNode, types: unknown[], out: unknown[] = []): unknown[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const child of tree) order(child, types, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<{ children?: ReactNode }>;
  if (types.includes(el.type)) out.push(el.type);
  return order(el.props.children, types, out);
}

async function tabsOf(detail: Row, query = "") {
  const { tree } = await renderDetail({ label: "User", columns: ["id", "email"], detail }, query);
  return (findAll(tree, DetailTabsClient)[0] as Tabs).tabs;
}

describe("related tabs on the card", () => {
  it("shows the row count in the label of a counted tab only", async () => {
    const tabs = await tabsOf({
      tabs: [
        { key: "info", label: "Info", fields: ["email"] },
        related("scores"),
        {
          key: "plain",
          label: "Plain",
          resource: "scores",
          filter: (u: Row) => ({ userId: u.id }),
        },
      ],
    });
    expect(tabs.map((tab) => tab.label)).toEqual(["Info", "Score · 3", "Plain"]);
  });

  it("pages by the tab's own pageSize", async () => {
    const tabs = await tabsOf({ tabs: [related("scores", { pageSize: 2 })] });
    const [rows] = findAll(tabs[0]?.content, RelatedTabTable);
    expect(rows?.pageSize).toBe(2);
  });

  it("renders a related tab's widgets above its rows", async () => {
    const tabs = await tabsOf({ tabs: [related("scores", { widgets: [stat("Total", 3)] })] });
    expect(order(tabs[0]?.content, [StatCard, RelatedTabTable])).toEqual([
      StatCard,
      RelatedTabTable,
    ]);
  });

  it("counts a count metric's rows of this record, and links to them", async () => {
    const tabs = await tabsOf({
      tabs: [{ key: "w", label: "W", widgets: [metric("Scores", { count: "scores" })] }],
    });
    const counted = listQueries.filter(
      (q) => (q as unknown as { select?: string[] }).select?.length === 0,
    );
    expect(counted.map((q) => q.filters)).toContainEqual({ userId: "u1" });
    const [card] = findAll(tabs[0]?.content, MetricCard);
    expect(card?.drilldown).toBe("/admin/scores?f_userId=u1");
  });

  it("narrows a resource table by its where", async () => {
    await tabsOf({
      tabs: [
        {
          key: "w",
          label: "W",
          widgets: [table({ resource: "scores", where: (c) => ({ userId: c.id }) })],
        },
      ],
    });
    expect(listQueries.map((q) => q.filters)).toContainEqual({ userId: "u1" });
  });
});
