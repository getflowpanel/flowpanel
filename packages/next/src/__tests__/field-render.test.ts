import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { drawerRoute } from "../drawer/drawer-route";
import { ResourceDetailPage } from "../pages/resource-detail";

const column = (name: string) => ({
  name,
  type: "string" as const,
  nullable: false,
  unique: name === "id",
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "jobs",
    primaryKey: "id",
    columns: [column("id"), column("categoryId"), column("secret")],
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async (_ref, ctx) => ({ id: ctx.id, categoryId: "web", secret: "classified" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function admin(secretRender: () => string) {
  const fields = [
    "id",
    {
      name: "categoryId",
      label: "Category",
      render: async (row: Record<string, unknown>) =>
        row.categoryId === "web" ? "Web development (38)" : "—",
    },
    { name: "secret", render: secretRender },
  ];
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "support" },
    resources: [
      resource(
        { __name: "jobs" },
        {
          columns: ["id", "categoryId", "secret"],
          fieldAccess: { secret: { read: "admin" } },
          drawer: { fields },
          detail: {
            tabs: [
              { key: "facts", label: "Facts", fields },
              { key: "hidden", label: "Hidden", fields: ["secret"], emptyState: "Nothing to see" },
            ],
          },
        },
      ),
    ] as never,
  });
}

function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (node === null || typeof node !== "object" || typeof node === "function") return "";
  const props = isValidElement(node) ? (node as ReactElement<Record<string, unknown>>).props : node;
  return Object.values(props as Record<string, unknown>)
    .map(textOf)
    .join(" ");
}

describe("a field with its own render", () => {
  it("shows the computed value on the detail page", async () => {
    const secret = vi.fn(() => "leak");
    const config = admin(secret);
    const jobs = config.resourcesByName.get("jobs");
    if (!jobs) throw new Error("fixture: resource not registered");
    const tree = await ResourceDetailPage({
      config,
      resource: jobs,
      name: "jobs",
      id: "j1",
      req: new Request("http://localhost/admin/jobs/j1?tab=facts"),
    });
    const text = textOf(tree);
    expect(text).toContain("Web development (38)");
    expect(text).not.toContain("leak");
    expect(secret).not.toHaveBeenCalled();
  });

  it("prerenders the computed value for the drawer", async () => {
    const secret = vi.fn(() => "leak");
    const res = await drawerRoute(admin(secret))(
      new Request("http://localhost/api/flowpanel/drawer/jobs/j1"),
      { params: Promise.resolve({ resource: "jobs", id: "j1" }) },
    );
    const body = (await res.json()) as { prerendered: Record<string, string> };
    expect(body.prerendered.categoryId).toBe("Web development (38)");
    expect(body.prerendered.secret).toBeUndefined();
    expect(secret).not.toHaveBeenCalled();
  });
});

describe("a fields tab", () => {
  it("leaves out a field the reader may not read, and shows its empty state when none is left", async () => {
    const config = admin(() => "leak");
    const jobs = config.resourcesByName.get("jobs");
    if (!jobs) throw new Error("fixture: resource not registered");
    const page = (tab: string) =>
      ResourceDetailPage({
        config,
        resource: jobs,
        name: "jobs",
        id: "j1",
        req: new Request(`http://localhost/admin/jobs/j1?tab=${tab}`),
      });
    expect(textOf(await page("facts"))).not.toContain("Secret");
    expect(textOf(await page("hidden"))).toContain("Nothing to see");
  });
});

describe("a drawer field render that throws", () => {
  it("falls back to the column render for that field", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "jobs" },
          {
            columns: [
              "id",
              {
                field: "categoryId",
                render: (row: Record<string, unknown>) => `cat:${row.categoryId}`,
              },
            ],
            drawer: {
              fields: [
                {
                  name: "categoryId",
                  render: () => {
                    throw new Error("lookup failed");
                  },
                },
              ],
            },
          },
        ),
      ] as never,
    });
    const res = await drawerRoute(config)(
      new Request("http://localhost/api/flowpanel/drawer/jobs/j1"),
      { params: Promise.resolve({ resource: "jobs", id: "j1" }) },
    );
    const body = (await res.json()) as { prerendered: Record<string, string> };
    expect(body.prerendered.categoryId).toBe("cat:web");
    expect(error).toHaveBeenCalledWith(
      '[flowpanel] drawer render failed for "categoryId"',
      expect.any(Error),
    );
    error.mockRestore();
  });
});
