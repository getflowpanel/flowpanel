import type { WidgetDateRange } from "@flowpanel/core";
import { kv, metric, stat } from "@flowpanel/core";
import { DashboardDateRange } from "@flowpanel/next/client";
import { KvCard, MetricCard, PageHeader, Section, StatCard, StatStrip } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { findAll, listQueries, renderDetail } from "./detail-fixture";

type Row = Record<string, unknown>;
type Props = Record<string, unknown> & { children?: ReactNode };

function first(
  tree: ReactNode,
  match: (el: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (tree === null || tree === undefined || typeof tree !== "object") return null;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = first(child, match);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(tree)) return null;
  const el = tree as ReactElement<Props>;
  if (match(el)) return el;
  return first(el.props.children, match);
}

const twoTabs = [
  { key: "a", label: "A", fields: ["plan"] },
  { key: "b", label: "B", fields: ["spend"] },
];

describe("the record page", () => {
  it("renders the strip and the aside on every tab, and reads kv fields from the record", async () => {
    const detail = {
      stats: [stat("Seats", 3)],
      aside: [kv({ label: "Profile", items: [{ label: "Email", field: "email" }] })],
      tabs: twoTabs,
    };
    for (const query of ["", "?tab=b"]) {
      const { tree } = await renderDetail({ label: "User", columns: ["id"], detail }, query);
      expect(findAll(tree, StatStrip)).toHaveLength(1);
      expect(findAll(tree, StatCard)[0]?.plain).toBe(true);
      expect(findAll(tree, KvCard)[0]?.items).toEqual([
        { label: "Email", value: "ada@example.com" },
      ]);
    }
  });

  it("reads a kv card's own record", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      detail: {
        aside: [
          kv({ record: async () => ({ plan: "team" }), items: [{ label: "Plan", field: "plan" }] }),
        ],
      },
    });
    expect(findAll(tree, KvCard)[0]?.items).toEqual([{ label: "Plan", value: "team" }]);
  });

  it("never reads a tone or a link from a kv field's stored value", async () => {
    const meta = { value: "x", tone: "err", href: "https://example.com" };
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      detail: {
        aside: [kv({ record: async () => ({ meta }), items: [{ label: "Meta", field: "meta" }] })],
      },
    });
    const [item] = findAll(tree, KvCard)[0]?.items as Array<Record<string, unknown>>;
    expect(item).not.toHaveProperty("tone");
    expect(item).not.toHaveProperty("href");
  });

  it("shares one count memo across the strip, the aside and the open tab", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      detail: {
        stats: [metric("Scores", { count: "scores" })],
        aside: [
          kv({
            items: [{ label: "Scores", value: async (c) => c.count("scores", { userId: c.id }) }],
          }),
        ],
        tabs: [{ key: "w", label: "W", widgets: [metric("Scores", { count: "scores" })] }],
      },
    });
    expect(findAll(tree, MetricCard).map((card) => card.value)).toEqual([3, 3]);
    expect(findAll(tree, KvCard)[0]?.items).toEqual([{ label: "Scores", value: "3" }]);
    const counts = listQueries.filter(
      (q) => (q as { select?: readonly string[] }).select?.length === 0,
    );
    expect(counts).toHaveLength(1);
  });

  it("passes several badges, dropping nullish ones and resolving links", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id", "plan"],
      detail: {
        badge: (u: Row) => [
          { label: String(u.plan), tone: "accent" as const },
          null,
          { label: "Scores", href: { resource: "scores", filter: { userId: u.id } } },
        ],
      },
    });
    const header = findAll(tree, PageHeader)[0];
    expect(header?.badges).toEqual([
      { label: "pro", tone: "accent" },
      { label: "Scores", href: "/admin/scores?f_userId=u1" },
    ]);
    expect(header?.badge).toBeUndefined();
  });

  it("hands header callbacks the admin's formatters", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      detail: { subtitle: (_u: Row, { format }) => format.number(1234) },
    });
    expect(findAll(tree, PageHeader)[0]?.description).toBe("1,234");
  });

  it("reaches widgets tabs with the picked range and its previous period", async () => {
    let seen: WidgetDateRange | undefined;
    const probe = stat("Probe", async (c) => {
      seen = c.dateRange;
      return 1;
    });
    const detail = {
      dateRange: { preset: "last30d" as const, presets: ["last7d" as const, "last30d" as const] },
      tabs: [{ key: "w", label: "W", widgets: [probe] }],
    };
    const { tree } = await renderDetail(
      { label: "User", columns: ["id"], detail },
      "?preset=last7d",
    );
    expect(seen?.preset).toBe("last7d");
    expect(seen?.previous).not.toBeNull();
    const actions = findAll(tree, PageHeader)[0]?.actions as ReactNode;
    expect(findAll(actions, DashboardDateRange)[0]).toMatchObject({
      preset: "last7d",
      presets: ["last7d", "last30d"],
    });
    await renderDetail({ label: "User", columns: ["id"], detail: { tabs: detail.tabs } });
    expect(seen?.from.getTime()).toBe(0);
    expect(seen?.previous).toBeNull();
  });

  it("puts the tabs before the aside, side by side only from lg", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      detail: { aside: [stat("Seats", 3)], tabs: twoTabs },
    });
    const layout = first(tree, (el) => el.props["data-record-layout"] !== undefined);
    expect(layout?.props.className).toBe("grid gap-4 lg:grid-cols-12");
    const [main, side] = layout?.props.children as ReactElement<Props>[];
    expect(main?.props.className).toBe("min-w-0 lg:col-span-8");
    expect(side?.type).toBe("aside");
    expect(side?.props.className).toBe("min-w-0 space-y-3 lg:col-span-4");
  });

  it("lays a widgets tab with spans on 12 columns", async () => {
    const { tree } = await renderDetail({
      label: "User",
      columns: ["id"],
      detail: { tabs: [{ key: "w", label: "W", widgets: [stat("Seats", 3, { span: 6 })] }] },
    });
    expect(findAll(tree, Section)[0]?.columns).toBe(12);
  });
});
