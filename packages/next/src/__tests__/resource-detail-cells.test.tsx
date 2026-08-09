import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { KVRow, StatusBadge } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail.js";

function findAllElements(
  tree: ReactNode,
  type: unknown,
  out: (Record<string, unknown> & { children?: ReactNode })[] = [],
): (Record<string, unknown> & { children?: ReactNode })[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const c of tree) findAllElements(c, type, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<
    Record<string, unknown> & { children?: ReactNode; tabs?: ReadonlyArray<{ content: ReactNode }> }
  >;
  if (el.type === type) out.push(el.props);
  if (el.type === DetailTabsClient && el.props.tabs) {
    for (const t of el.props.tabs) findAllElements(t.content, type, out);
  }
  findAllElements(el.props.children, type, out);
  return out;
}

function mkAdapter(row: Record<string, unknown>): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () =>
      ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
        Adapter["inferSchema"]
      >,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 25 }),
    get: async () => row,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

const ROW = { id: "22", email: "a@b.co", plan: "starter", createdAt: "2026-01-02T03:04:00.000Z" };

async function renderDetail(options: Record<string, unknown>): Promise<ReactNode> {
  const config = defineAdmin({
    adapter: mkAdapter(ROW),
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource({ __name: "users" }, options as never)],
  });
  const resourceCfg = config.resourcesByName.get("users");
  if (!resourceCfg) throw new Error("users resource not registered");
  return ResourceDetailPage({
    config,
    resource: resourceCfg,
    name: "users",
    id: "22",
    req: new Request("http://localhost/admin/users/22"),
  });
}

describe("ResourceDetailPage — column pipeline", () => {
  it("labels KV rows from the column label, humanizing the rest", async () => {
    const node = await renderDetail({
      columns: ["id", { field: "email", label: "Email address" }, "createdAt"],
    });
    const labels = findAllElements(node, KVRow).map((r) => r.label);
    expect(labels).toEqual(["ID", "Email address", "Created at"]);
  });

  it("renders a `format: badge` column as a badge, not raw text", async () => {
    const node = await renderDetail({
      columns: ["id", { field: "plan", format: "badge" }],
    });
    const planRow = findAllElements(node, KVRow).find((r) => r.label === "Plan");
    const value = planRow?.value as ReactElement<{ status?: string }>;
    expect(isValidElement(value)).toBe(true);
    expect(value.type).toBe(StatusBadge);
    expect(value.props.status).toBe("starter");
  });

  it("uses the column's own render for the value", async () => {
    const node = await renderDetail({
      columns: [
        "id",
        {
          field: "createdAt",
          label: "Joined",
          render: (r: Record<string, unknown>) => `on ${String(r.createdAt).slice(0, 10)}`,
        },
      ],
    });
    const joined = findAllElements(node, KVRow).find((r) => r.label === "Joined");
    expect(joined?.value).toBe("on 2026-01-02");
  });

  it("applies the same pipeline inside a fields detail tab", async () => {
    const node = await renderDetail({
      columns: ["id", { field: "plan", label: "Plan tier", format: "badge" }],
      detail: { tabs: [{ key: "overview", label: "Overview", fields: "*" }] },
    });
    const rows = findAllElements(node, KVRow);
    const plan = rows.find((r) => r.label === "Plan tier");
    expect(rows.map((r) => r.label)).toEqual(["ID", "Plan tier"]);
    expect((plan?.value as ReactElement).type).toBe(StatusBadge);
  });

  it("humanizes fields no column covers and formats them generically", async () => {
    const node = await renderDetail({
      columns: ["id"],
      detail: {
        tabs: [{ key: "overview", label: "Overview", fields: ["id", "createdAt"] }],
      },
    });
    const rows = findAllElements(node, KVRow);
    expect(rows.map((r) => r.label)).toEqual(["ID", "Created at"]);
  });

  it("keeps an explicit FieldDef label over the column label", async () => {
    const node = await renderDetail({
      columns: [{ field: "plan", label: "Plan tier" }],
      detail: {
        tabs: [
          {
            key: "overview",
            label: "Overview",
            fields: [{ name: "plan", label: "Subscription" }],
          },
        ],
      },
    });
    const rows = findAllElements(node, KVRow);
    expect(rows.map((r) => r.label)).toEqual(["Subscription"]);
  });
});
