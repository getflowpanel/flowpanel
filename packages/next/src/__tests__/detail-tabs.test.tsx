import type { DetailTabContext } from "@flowpanel/core";
import { stat } from "@flowpanel/core";
import { RelatedTabTable, WidgetErrorBoundary } from "@flowpanel/next/client";
import { ErrorCard, KVRow, PageHeader, Section, StatCard } from "@flowpanel/react";
import { describe, expect, it } from "vitest";
import { findAll, listQueries, renderDetail } from "./detail-fixture";

type Row = Record<string, unknown>;

const relatedTab = {
  key: "scores",
  label: "Scores",
  resource: "scores" as const,
  filter: (row: Row) => ({ userId: row.id }),
};

async function table(users: Parameters<typeof renderDetail>[0], query: string) {
  const { tree } = await renderDetail(users, query);
  return findAll(tree, RelatedTabTable)[0];
}

const withRelated: Parameters<typeof renderDetail>[0] = {
  label: "Customer",
  columns: ["id"],
  detail: { tabs: [{ ...relatedTab, hide: ["userId"] }] },
};

describe("a related detail tab", () => {
  it("resolves a reference column to the referenced row's label", async () => {
    const props = await table(
      { label: "Customer", columns: ["id"], detail: { tabs: [relatedTab] } },
      "?tab=scores",
    );
    const columns = props?.columns as { field: string }[];
    const ownerIndex = columns.findIndex((c) => c.field === "userId");
    const cells = props?.prerenderedCells as unknown[][];
    expect(ownerIndex).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(cells[0]?.[ownerIndex])).toContain("ada@example.com");
  });

  it("drops a hidden column before the cells are prerendered", async () => {
    const props = await table(withRelated, "?tab=scores");
    const columns = props?.columns as { field: string }[];
    expect(columns.map((c) => c.field)).toEqual(["id", "value"]);
    expect(props?.prerenderedCells).toBeUndefined();
  });

  it("applies the tab's declared sort", async () => {
    await table(
      {
        label: "Customer",
        columns: ["id"],
        detail: { tabs: [{ ...relatedTab, sort: { field: "value", dir: "desc" as const } }] },
      },
      "?tab=scores",
    );
    expect(listQueries[0]?.sort).toEqual({ field: "value", dir: "desc" });
  });

  it("takes the sort from the URL under the tab's own key", async () => {
    const props = await table(withRelated, "?tab=scores&relatedSort.scores=value.desc");
    expect(listQueries[0]?.sort).toEqual({ field: "value", dir: "desc" });
    expect(props?.sort).toEqual({ field: "value", dir: "desc" });
    expect(props?.sortParam).toBe("relatedSort.scores");
  });

  it("ignores a URL sort field the target never declared", async () => {
    await table(withRelated, "?tab=scores&relatedSort.scores=secret.desc");
    expect(listQueries[0]?.sort).toEqual({ field: "id", dir: "asc" });
  });

  it("ignores a URL sort with a direction it cannot read", async () => {
    await table(withRelated, "?tab=scores&relatedSort.scores=value.sideways");
    expect(listQueries[0]?.sort).toEqual({ field: "id", dir: "asc" });
  });

  it("ignores another tab's sort key", async () => {
    await table(withRelated, "?tab=scores&relatedSort.other=value.desc");
    expect(listQueries[0]?.sort).toEqual({ field: "id", dir: "asc" });
  });

  it("ignores a URL sort naming a column `hide` dropped", async () => {
    await table(withRelated, "?tab=scores&relatedSort.scores=userId.desc");
    expect(listQueries[0]?.sort).toEqual({ field: "id", dir: "asc" });
  });

  it("keeps a hidden field out of the rows it hands the client", async () => {
    const props = await table(withRelated, "?tab=scores");
    const rows = props?.rows as Record<string, unknown>[];
    expect(rows.every((r) => !("userId" in r))).toBe(true);
    expect(rows[0]).toEqual({ id: "s1", value: 10 });
  });

  it("links to the target's own list with the relationship filter applied", async () => {
    const props = await table(withRelated, "?tab=scores");
    expect(props?.openListHref).toBe("/admin/scores?f_userId=u1");
    expect(props?.openListLabel).toBe("Open list →");
  });

  it("omits the open-list link when a filter value is not a scalar", async () => {
    const props = await table(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [
            {
              ...relatedTab,
              filter: (row: Row) => ({ userId: { op: "in", values: [row.id] } }),
            },
          ],
        },
      },
      "?tab=scores",
    );
    expect(props?.openListHref).toBeUndefined();
    expect(props?.openListLabel).toBeUndefined();
  });

  it("omits the open-list link when the filter field is not a declared column", async () => {
    const props = await table(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [{ ...relatedTab, resource: "notes" as const }],
        },
      },
      "?tab=scores",
    );
    expect(props?.openListHref).toBeUndefined();
  });
});

describe("a fields tab with sections", () => {
  it("renders one block per section with its own heading", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id", "email", { field: "spend", label: "Spend", format: "money" }],
        detail: {
          tabs: [
            {
              key: "overview",
              label: "Overview",
              sections: [
                { label: "Identity", fields: ["id", "email"] },
                { label: "Money", fields: ["spend"] },
              ],
            },
          ],
        },
      },
      "?tab=overview",
    );
    const sections = findAll(tree, Section);
    expect(sections.map((s) => s.label)).toEqual(["Identity", "Money"]);
    const rows = findAll(tree, KVRow);
    expect(rows.map((r) => r.label)).toEqual(["ID", "Email", "Spend"]);
  });

  it("wins over a plain field list on the same tab", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id", "email"],
        detail: {
          tabs: [
            {
              key: "overview",
              label: "Overview",
              fields: ["email"],
              sections: [{ label: "Identity", fields: ["id"] }],
            },
          ],
        },
      },
      "?tab=overview",
    );
    expect(findAll(tree, KVRow).map((r) => r.label)).toEqual(["ID"]);
  });

  it("loads the fields a section declares without a separate expose", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [
            {
              key: "overview",
              label: "Overview",
              sections: [{ label: "Plan", fields: [{ name: "plan", label: "Tier" }] }],
            },
          ],
        },
      },
      "?tab=overview",
    );
    const rows = findAll(tree, KVRow);
    expect(rows.map((r) => r.label)).toEqual(["Tier"]);
    expect(rows[0]?.value).toBe("pro");
  });
});

describe("a widgets tab", () => {
  it("renders dashboard widgets against the record being viewed", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [
            {
              key: "activity",
              label: "Activity",
              columns: 2,
              widgets: [stat("Record", async (ctx) => String(ctx.row?.id ?? "none"))],
            },
          ],
        },
      },
      "?tab=activity",
    );
    const cards = findAll(tree, StatCard);
    expect(cards[0]?.label).toBe("Record");
    expect(cards[0]?.value).toBe("u1");
    expect(findAll(tree, Section)[0]?.columns).toBe(2);
  });
});

describe("a widgets tab that fails", () => {
  it("renders one error card and keeps the other widgets", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [
            {
              key: "activity",
              label: "Activity",
              widgets: [
                stat("Broken", async () => {
                  throw new Error("query exploded");
                }),
                stat("Fine", async () => "ok"),
              ],
            },
          ],
        },
      },
      "?tab=activity",
    );
    expect(findAll(tree, ErrorCard)).toHaveLength(1);
    const cards = findAll(tree, StatCard);
    expect(cards.map((c) => c.label)).toEqual(["Fine"]);
    expect(findAll(tree, PageHeader)).toHaveLength(1);
  });

  it("wraps every widget in the dashboard's error boundary", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [{ key: "activity", label: "Activity", widgets: [stat("Record", async () => 1)] }],
        },
      },
      "?tab=activity",
    );
    expect(findAll(tree, WidgetErrorBoundary)[0]?.widgetId).toBe("activity.w0");
  });

  it("treats an empty widgets array as a widgets tab with nothing in it", async () => {
    const { tree } = await renderDetail(
      {
        label: "Customer",
        columns: ["id", "email"],
        detail: { tabs: [{ key: "activity", label: "Activity", widgets: [] }] },
      },
      "?tab=activity",
    );
    expect(findAll(tree, Section)).toHaveLength(1);
    expect(findAll(tree, KVRow)).toHaveLength(0);
  });
});

describe("a render tab", () => {
  it("receives the projected row and a context that can build links", async () => {
    const seen: { row: Row; ctx: DetailTabContext }[] = [];
    await renderDetail(
      {
        label: "Customer",
        columns: ["id"],
        detail: {
          tabs: [
            {
              key: "custom",
              label: "Custom",
              render: (row: Row, ctx: DetailTabContext) => {
                seen.push({ row, ctx });
                return null;
              },
            },
          ],
        },
      },
      "?tab=custom",
    );
    const entry = seen[0];
    expect(Object.keys(entry?.row ?? {})).toEqual(["id"]);
    expect(entry?.ctx.href("scores", undefined, { filter: { userId: "u1" } })).toBe(
      "/admin/scores?f_userId=u1",
    );
    expect(entry?.ctx.labels.related.openList).toBe("Open list →");
    expect(entry?.ctx.db).toEqual({ tag: "db" });
    expect(typeof entry?.ctx.query).toBe("function");
  });
});
