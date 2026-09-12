import type { Adapter, ListQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient, RelatedTabTable } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";
import { MAX_PAGE } from "../runtime/parse-list-params";

/** The active tab's content lives on `DetailTabsClient`'s `tabs` prop, not in children. */
function findAll(
  tree: ReactNode,
  type: unknown,
  out: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const child of tree) findAll(child, type, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<
    Record<string, unknown> & { children?: ReactNode; tabs?: ReadonlyArray<{ content: ReactNode }> }
  >;
  if (el.type === type) out.push(el.props);
  if (el.type === DetailTabsClient && el.props.tabs) {
    for (const tab of el.props.tabs) findAll(tab.content, type, out);
  }
  findAll(el.props.children, type, out);
  return out;
}

const SCORES = Array.from({ length: 26 }, (_, i) => ({
  id: `s${i + 1}`,
  userId: "u1",
  value: i + 1,
}));

const queries: ListQueryContext<unknown>[] = [];

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => {
    const name = (ref as { __name: string }).__name;
    return name === "users"
      ? {
          name,
          columns: [
            { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
          ],
          primaryKey: "id",
        }
      : {
          name,
          columns: [
            { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
            { name: "userId", type: "string", nullable: false, unique: false, primaryKey: false },
            { name: "value", type: "number", nullable: false, unique: false, primaryKey: false },
          ],
          primaryKey: "id",
        };
  },
  inferSchema: () => ({}) as never,
  list: async (_ref, ctx) => {
    queries.push(ctx as ListQueryContext<unknown>);
    const { page, pageSize } = ctx as { page: number; pageSize: number };
    const matching = SCORES.filter(
      (row) => row.userId === (ctx as { filters: Record<string, unknown> }).filters.userId,
    );
    return {
      rows: matching.slice((page - 1) * pageSize, page * pageSize),
      total: matching.length,
      page,
      pageSize,
    };
  },
  get: async () => ({ id: "u1" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

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
              {
                key: "scores",
                label: "Scores",
                resource: "scores",
                filter: (row: Record<string, unknown>) => ({ userId: row.id }),
              },
              {
                key: "other",
                label: "Other",
                resource: "scores",
                filter: (row: Record<string, unknown>) => ({ userId: row.id }),
              },
              {
                key: "ghost",
                label: "Ghost",
                resource: "scores",
                filter: (row: Record<string, unknown>) => ({ userId: row.notProjected }),
              },
            ],
          },
        },
      ),
      resource({ __name: "scores" }, { columns: ["id", "value"] }),
    ],
  });
}

async function tableFor(query: string) {
  queries.length = 0;
  const config = admin();
  const users = config.resourcesByName.get("users");
  if (!users) throw new Error("fixture: resource not registered");
  const tree = await ResourceDetailPage({
    config,
    resource: users,
    name: "users",
    id: "u1",
    req: new Request(`http://localhost/admin/users/u1${query}`),
  });
  return findAll(tree, RelatedTabTable)[0];
}

describe("a related history longer than one page", () => {
  it("shows the first page and reports the real total", async () => {
    const table = await tableFor("?tab=scores");
    expect(table?.page).toBe(1);
    expect(table?.total).toBe(26);
    expect((table?.rows as { id: string }[]).map((r) => r.id)).toHaveLength(25);
  });

  it("reaches the last record through its own namespaced page key", async () => {
    const table = await tableFor("?tab=scores&relatedPage.scores=2");
    expect(table?.page).toBe(2);
    expect(table?.total).toBe(26);
    expect((table?.rows as { id: string }[]).map((r) => r.id)).toEqual(["s26"]);
    expect(table?.pageParam).toBe("relatedPage.scores");
  });

  it("corrects a page past the end back to the last one that has rows", async () => {
    const table = await tableFor("?tab=scores&relatedPage.scores=9");
    expect(table?.page).toBe(2);
    expect((table?.rows as { id: string }[]).map((r) => r.id)).toEqual(["s26"]);
  });

  it("treats garbage and zero as the first page", async () => {
    for (const raw of ["0", "-3", "abc", "", "2.7"]) {
      expect((await tableFor(`?tab=scores&relatedPage.scores=${raw}`))?.page).toBe(
        raw === "2.7" ? 2 : 1,
      );
    }
  });

  it("bounds an absurd page instead of asking the adapter for it", async () => {
    expect((await tableFor("?tab=scores&relatedPage.scores=1e9999"))?.page).toBe(1);
    const table = await tableFor("?tab=scores&relatedPage.scores=999999999");
    expect(table?.page).toBe(2);
    expect(queries.every((query) => (query as { page: number }).page <= MAX_PAGE)).toBe(true);
  });

  it("ignores another tab's page key", async () => {
    const table = await tableFor("?tab=scores&relatedPage.other=2");
    expect(table?.page).toBe(1);
    expect((table?.rows as { id: string }[])[0]?.id).toBe("s1");
  });

  it("queries only the active tab", async () => {
    await tableFor("?tab=scores");
    expect(queries).toHaveLength(1);
  });

  it("sorts by the introspected primary key when the target declares no default", async () => {
    await tableFor("?tab=scores");
    expect(queries[0]?.sort).toEqual({ field: "id", dir: "asc" });
  });

  it("asks for no rows and no query when the relationship value is missing", async () => {
    const table = await tableFor("?tab=ghost");
    expect(table?.total).toBe(0);
    expect(table?.rows).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it("keeps the relationship filter and the narrow selection on every page", async () => {
    await tableFor("?tab=scores&relatedPage.scores=2");
    for (const query of queries) {
      expect(query.filters).toEqual({ userId: "u1" });
      expect([...(query.select ?? [])].sort()).toEqual(["id", "value"]);
    }
  });
});
