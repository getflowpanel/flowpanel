import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient, RelatedTabTable } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";

function find(tree: ReactNode, type: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = find(child, type);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<
    Record<string, unknown> & { children?: ReactNode; tabs?: ReadonlyArray<{ content: ReactNode }> }
  >;
  if (el.type === type) return el.props;
  if (el.type === DetailTabsClient && el.props.tabs) {
    for (const tab of el.props.tabs) {
      const found = find(tab.content, type);
      if (found) return found;
    }
  }
  return find(el.props.children, type);
}

const ROWS = [
  { id: "a/1", userId: "u1", value: 1 },
  { id: "a2", userId: "u1", value: 2 },
  { id: null, userId: "u3", value: 3 },
];

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "userId", type: "string", nullable: false, unique: false, primaryKey: false },
      { name: "value", type: "number", nullable: false, unique: false, primaryKey: false },
    ],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async (_ref, ctx) => {
    const { filters } = ctx as { filters: Record<string, unknown> };
    const rows = ROWS.filter((row) => row.userId === filters.userId);
    return { rows, total: rows.length, page: 1, pageSize: 25 };
  },
  get: async (_ref, ctx) => ({ id: ctx.id }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const byUser = (row: Record<string, unknown>) => ({ userId: row.id });
const tab = (target: string, extra: Record<string, unknown> = {}) => ({
  key: target,
  label: target,
  resource: target,
  filter: byUser,
  ...extra,
});
const drawer = { tabs: [{ key: "main", label: "Main", fields: ["value"] }] };

function admin() {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id"],
          detail: {
            tabs: [
              tab("withDetail"),
              tab("drawerOnly"),
              tab("both"),
              tab("plain"),
              tab("optedOut"),
              tab("quiet", { resource: "plain", emptyState: "No runs for this user yet" }),
              { key: "noWidgets", label: "Charts", widgets: [], emptyState: "No charts yet" },
              { key: "noFields", label: "Facts", fields: [], emptyState: "Nothing on file" },
            ],
          },
        },
      ),
      resource({ __name: "withDetail" }, { columns: ["id", "value"], detail: {} }),
      resource({ __name: "drawerOnly" }, { columns: ["id", "value"], drawer }),
      resource({ __name: "both" }, { columns: ["id", "value"], detail: {}, drawer }),
      resource({ __name: "plain" }, { columns: ["id", "value"] }),
      resource({ __name: "optedOut" }, { columns: ["id", "value"], detail: {}, rowClick: false }),
    ] as never,
  });
}

async function detailPage(tabKey: string, id: string) {
  const config = admin();
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("fixture: resource not registered");
  return ResourceDetailPage({
    config,
    resource: users,
    name: "users",
    id,
    req: new Request(`http://localhost/admin/users/${id}?tab=${tabKey}`),
  });
}

async function relatedTable(tabKey: string, id = "u1") {
  return find(await detailPage(tabKey, id), RelatedTabTable);
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (!isValidElement(node)) return "";
  return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
}

async function activeTabText(tabKey: string) {
  const client = find(await detailPage(tabKey, "u1"), DetailTabsClient) as {
    tabs: { key: string; content: ReactNode }[];
  };
  return textOf(client.tabs.find((tab) => tab.key === tabKey)?.content);
}

describe("a related tab's rows open like the target's own list", () => {
  it("link to the target's detail page when it has one", async () => {
    const table = await relatedTable("withDetail");
    expect(table?.rowHrefs).toEqual(["/admin/withDetail/a%2F1", "/admin/withDetail/a2"]);
  });

  it("open the target's drawer on its list when it only has a drawer", async () => {
    const table = await relatedTable("drawerOnly");
    expect(table?.rowHrefs).toEqual([
      "/admin/drawerOnly?drawer=drawerOnly%3Aa%2F1",
      "/admin/drawerOnly?drawer=drawerOnly%3Aa2",
    ]);
  });

  it("follow the list's drawer default when the target has both", async () => {
    const table = await relatedTable("both");
    expect(table?.rowHrefs).toEqual([
      "/admin/both?drawer=both%3Aa%2F1",
      "/admin/both?drawer=both%3Aa2",
    ]);
  });

  it("stay inert when no row can be identified", async () => {
    expect((await relatedTable("withDetail", "u3"))?.rowHrefs).toBeUndefined();
  });

  it("stay inert when the target's list rows are inert", async () => {
    expect((await relatedTable("plain"))?.rowHrefs).toBeUndefined();
    expect((await relatedTable("optedOut"))?.rowHrefs).toBeUndefined();
  });
});

describe("a detail tab's empty state", () => {
  it("replaces the generic label on a related tab with no rows", async () => {
    const table = await relatedTable("quiet", "u2");
    expect(table?.rows).toEqual([]);
    expect(table?.emptyTitle).toBe("No runs for this user yet");
  });

  it("leaves the related table's generic label alone otherwise", async () => {
    expect((await relatedTable("plain", "u2"))?.emptyTitle).toBeUndefined();
  });

  it("replaces the generic label on an empty widgets tab", async () => {
    expect(await activeTabText("noWidgets")).toContain("No charts yet");
  });

  it("replaces the generic label on a fields tab with nothing to show", async () => {
    expect(await activeTabText("noFields")).toContain("Nothing on file");
  });
});
