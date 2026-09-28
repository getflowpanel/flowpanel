import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ColumnMeta, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { z } from "zod";
import { makeActions } from "../actions/resource-actions";
import { deleteRow } from "../runtime/delete-row";

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

const view = { __name: "admin_user_row" };
const table = { __name: "user" };
const rows = { view: { id: "u1", name: "Ada", sent: 2 } };
const touched: Array<{ op: string; ref: unknown }> = [];

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) =>
    ref === view
      ? {
          name: "admin_user_row",
          kind: "view",
          columns: ["id", "name", "sent"].map(meta),
          primaryKey: "id",
        }
      : { name: "user", columns: ["id", "name"].map(meta), primaryKey: "id" },
  inferSchema: (ref) => {
    touched.push({ op: "inferSchema", ref });
    const schema = z.object({ name: z.string().optional() });
    return { create: schema, update: schema, select: schema };
  },
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async (ref) => {
    touched.push({ op: "get", ref });
    return ref === view ? rows.view : { id: "u1", name: "Ada" };
  },
  create: async (ref) => {
    touched.push({ op: "create", ref });
    return { id: "u2", name: "Bea" };
  },
  update: async (ref) => {
    touched.push({ op: "update", ref });
    rows.view = { ...rows.view, name: "Ada L." };
    return { id: "u1", name: "Ada L." };
  },
  delete: async (ref) => {
    touched.push({ op: "delete", ref });
  },
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource(view, {
      name: "user",
      writeTo: table,
      columns: ["id", "name", "sent"],
      update: { fields: [{ name: "name" }] },
    }),
  ],
});

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin/user/u1/edit"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

describe("writes through writeTo", () => {
  const user = config.resourcesByName.get("user");
  if (!user) throw new Error("fixture: user not registered");

  it("infers the write schema from the table", () => {
    touched.length = 0;
    makeActions(config, user, { reqCtx, publish: false });
    expect(touched).toEqual([{ op: "inferSchema", ref: table }]);
  });

  it("updates the table and answers with the view's row", async () => {
    touched.length = 0;
    const result = await makeActions(config, user, { reqCtx, publish: false }).update("u1", {
      name: "Ada L.",
    });
    expect(touched.filter((t) => t.op === "update")).toEqual([{ op: "update", ref: table }]);
    expect(result).toEqual({ id: "u1", name: "Ada L.", sent: 2 });
  });

  it("creates and deletes on the table", async () => {
    touched.length = 0;
    await makeActions(config, user, { reqCtx, publish: false }).create({ name: "Bea" });
    await deleteRow(config, user, "u1", reqCtx);
    expect(touched.filter((t) => t.op === "create" || t.op === "delete")).toEqual([
      { op: "create", ref: table },
      { op: "delete", ref: table },
    ]);
  });
});
