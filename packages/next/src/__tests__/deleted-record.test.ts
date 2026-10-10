import type { Adapter, ItemQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { RestoreButton } from "@flowpanel/next/client";
import { HealthBanner } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createResourceController } from "../controllers/resource-controller";
import { drawerRoute } from "../drawer/drawer-route";
import { ResourceDetailPage } from "../pages/resource-detail";

type Props = Record<string, unknown> & { children?: ReactNode };

function find(tree: ReactNode, type: unknown): ReactElement<Props> | null {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<Props>(tree)) return null;
  if (tree.type === type) return tree;
  return find(tree.props.children, type);
}

const ROWS: Record<string, Record<string, unknown>> = {
  live: { id: "live", email: "live@x.com", deletedAt: null },
  gone: { id: "gone", email: "gone@x.com", deletedAt: new Date("2026-01-01") },
};

const selects: (readonly string[] | undefined)[] = [];

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "users",
    columns: ["id", "email", "deletedAt"].map((name) => ({
      name,
      type: "string" as const,
      nullable: name === "deletedAt",
      unique: name === "id",
      primaryKey: name === "id",
    })),
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async (_ref, ctx: ItemQueryContext) => {
    selects.push(ctx.select);
    return ROWS[ctx.id] ?? null;
  },
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
  restore: async () => undefined,
};

function admin(role: "admin" | "viewer") {
  return defineAdmin({
    adapter,
    auth: { session: async () => ({ id: "u1" }), role: () => role, access: () => true },
    resources: [
      resource(
        { __name: "users" },
        {
          label: "Users",
          labelOne: "User",
          columns: ["id", "email"],
          access: { read: ["admin", "viewer"], update: "admin" },
          delete: { softDelete: "deletedAt" },
          detail: {},
          drawer: { fields: ["email"] },
        },
      ),
    ],
  });
}

function detail(role: "admin" | "viewer", id: string) {
  const config = admin(role);
  const target = config.resourcesByName.get("users");
  if (!target) throw new Error("fixture: users not registered");
  return ResourceDetailPage({
    config,
    resource: target,
    name: "users",
    id,
    req: new Request(`http://localhost/admin/users/${id}`),
  });
}

function drawer(role: "admin" | "viewer", id: string) {
  return drawerRoute(admin(role))(
    new Request(`http://localhost/api/flowpanel/drawer/users/${id}`),
    {
      params: Promise.resolve({ resource: "users", id }),
    },
  );
}

function item(role: "admin" | "viewer", id: string) {
  const config = admin(role);
  const target = config.resourcesByName.get("users");
  if (!target) throw new Error("fixture: users not registered");
  return createResourceController(config, target, {
    req: new Request(`http://localhost/api/flowpanel/users/${id}`),
    session: { id: "u1" },
    role,
    scope: null,
    ip: null,
    userAgent: null,
  }).get(id);
}

describe("a soft-deleted record opened by id", () => {
  it("reads as not found to someone who could not restore it", async () => {
    await expect(detail("viewer", "gone")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    expect((await drawer("viewer", "gone")).status).toBe(404);
    expect(await item("viewer", "gone")).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("shows who may restore it that it was deleted, with Restore", async () => {
    const tree = await detail("admin", "gone");
    const banner = find(tree, HealthBanner);
    expect(banner?.props.title).toBe("This user was deleted");
    expect(isValidElement(banner?.props.action) && banner.props.action.type).toBe(RestoreButton);
    const res = await drawer("admin", "gone");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deleted: true });
    expect(await item("admin", "gone")).toMatchObject({ ok: true, data: { id: "gone" } });
  });

  it("reads the soft-delete column without handing it to the reader", async () => {
    selects.length = 0;
    const res = await drawer("viewer", "live");
    expect(await res.json()).toMatchObject({ deleted: false, row: { email: "live@x.com" } });
    expect(selects.at(-1)).toContain("deletedAt");
    const read = await item("viewer", "live");
    expect(read).toMatchObject({ ok: true });
    expect(read.ok && Object.keys(read.data)).not.toContain("deletedAt");
    expect(find(await detail("viewer", "live"), HealthBanner)).toBeNull();
  });
});
