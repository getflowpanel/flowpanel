import type { Adapter, ListQueryContext, ResourceOptions } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { ResourceDetailPage } from "../pages/resource-detail";

type Row = Record<string, unknown>;

/** The active tab's content lives on `DetailTabsClient`'s `tabs` prop, not in children. */
export function findAll(
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

export const USERS = [{ id: "u1", email: "ada@example.com", plan: "pro", spend: 1200 }];

export const SCORES = Array.from({ length: 3 }, (_, i) => ({
  id: `s${i + 1}`,
  userId: "u1",
  value: (i + 1) * 10,
}));

/** A target whose declared columns do not include the relationship key. */
export const NOTES = [{ id: "n1", userId: "u1", body: "hello" }];

export const listQueries: ListQueryContext<unknown>[] = [];

const COLUMNS: Record<string, { name: string; type: "string" | "number" }[]> = {
  users: [
    { name: "id", type: "string" },
    { name: "email", type: "string" },
    { name: "plan", type: "string" },
    { name: "spend", type: "number" },
  ],
  scores: [
    { name: "id", type: "string" },
    { name: "userId", type: "string" },
    { name: "value", type: "number" },
  ],
  notes: [
    { name: "id", type: "string" },
    { name: "userId", type: "string" },
    { name: "body", type: "string" },
  ],
};

function sourceFor(name: string): Row[] {
  if (name === "users") return USERS as Row[];
  if (name === "notes") return NOTES as Row[];
  return SCORES as Row[];
}

export const adapter: Adapter = {
  kind: "drizzle",
  db: { tag: "db" },
  introspect: (ref) => {
    const name = (ref as { __name: string }).__name;
    return {
      name,
      columns: (COLUMNS[name] ?? []).map((c) => ({
        ...c,
        nullable: false,
        unique: c.name === "id",
        primaryKey: c.name === "id",
      })),
      primaryKey: "id",
    };
  },
  inferSchema: () => ({}) as never,
  list: async (ref, ctx) => {
    const name = (ref as { __name: string }).__name;
    listQueries.push(ctx as ListQueryContext<unknown>);
    const { page, pageSize, sort } = ctx as {
      page: number;
      pageSize: number;
      sort: { field: string; dir: "asc" | "desc" } | null;
    };
    const rows = [...sourceFor(name)];
    if (sort) {
      rows.sort((a, b) => {
        const l = String(a[sort.field] ?? "");
        const r = String(b[sort.field] ?? "");
        return sort.dir === "asc" ? l.localeCompare(r) : r.localeCompare(l);
      });
    }
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },
  get: async (ref, ctx) => {
    const id = (ctx as { id: string }).id;
    return sourceFor((ref as { __name: string }).__name).find((row) => row.id === id) ?? null;
  },
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

export function admin(users: ResourceOptions<Row>) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource({ __name: "users" }, users),
      resource({ __name: "notes" }, { label: "Note", columns: ["id", "body"] }),
      resource(
        { __name: "scores" },
        {
          label: "Score",
          columns: [
            "id",
            {
              field: "userId",
              label: "Owner",
              reference: { resource: "users", labelField: "email" },
            },
            { field: "value", label: "Points" },
          ],
        },
      ),
    ],
  });
}

export async function renderDetail(
  users: ResourceOptions<Row>,
  query = "",
): Promise<{ tree: ReactNode; config: ReturnType<typeof admin> }> {
  listQueries.length = 0;
  const config = admin(users);
  const target = config.resourcesByName.get("users");
  if (!target) throw new Error("fixture: users not registered");
  const tree = await ResourceDetailPage({
    config,
    resource: target,
    name: "users",
    id: "u1",
    req: new Request(`http://localhost/admin/users/u1${query}`),
  });
  return { tree, config };
}
