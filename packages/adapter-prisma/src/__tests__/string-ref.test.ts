import { defineAdmin, resolveResourceName, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { prismaAdapter } from "../adapter.js";
import type { PrismaDmmf } from "../introspect.js";

const dmmf: PrismaDmmf = {
  datamodel: {
    models: [
      {
        name: "User",
        fields: [
          {
            name: "id",
            kind: "scalar",
            type: "Int",
            isId: true,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefault: true,
          },
          {
            name: "email",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: true,
            isUnique: true,
            isList: false,
            hasDefault: false,
          },
        ],
      },
    ],
    enums: [],
  },
};

function makeDelegate() {
  return {
    findMany: vi.fn().mockResolvedValue([{ id: 1, email: "a@b.com" }]),
    findUnique: vi.fn().mockResolvedValue({ id: 1, email: "a@b.com" }),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue({ id: 2, email: "new@b.com" }),
    update: vi.fn().mockResolvedValue({ id: 1, email: "new@b.com" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
}

/** The documented Prisma form: `resource("User", ...)` — the ref is the model name. */
function setup() {
  const delegate = makeDelegate();
  const config = defineAdmin({
    adapter: prismaAdapter({ prisma: { user: delegate }, dmmf }),
    auth: { session: async () => null, role: () => "guest" },
    resources: [resource("User", { columns: ["email"], search: ["email"] })],
  });
  const entry = config.resourcesByName.get("User");
  if (!entry) throw new Error("resource was not registered");
  return { config, delegate, entry };
}

// Contexts are cast — the tests only exercise the fields the adapter reads.
const listCtx: any = { page: 1, pageSize: 10, filters: {}, db: undefined };
const mutCtx = (extra: Record<string, unknown>): any => ({ db: undefined, ...extra });

describe("Prisma string ref through defineAdmin", () => {
  it("registers the model name as the resource name and keeps the ref a string", () => {
    const { config, entry } = setup();
    expect(config.resourcesByName.has("User")).toBe(true);
    expect(entry.ref).toBe("User");
    expect(resolveResourceName(entry)).toBe("User");
  });

  it("introspect and inferSchema accept the registered ref", () => {
    const { config, entry } = setup();
    const intro = config.adapter.introspect(entry.ref);
    expect(intro.name).toBe("User");
    expect(intro.primaryKey).toBe("id");
    expect(config.adapter.inferSchema(entry.ref).create).toBeDefined();
  });

  it("list / get / create / update / delete all reach the prisma.user delegate", async () => {
    const { config, delegate, entry } = setup();

    const list = await config.adapter.list(entry.ref, listCtx);
    expect(list.rows).toEqual([{ id: 1, email: "a@b.com" }]);
    expect(delegate.findMany).toHaveBeenCalled();

    expect(await config.adapter.get(entry.ref, mutCtx({ id: "1" }))).toEqual({
      id: 1,
      email: "a@b.com",
    });
    expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });

    await config.adapter.create(entry.ref, mutCtx({ input: { email: "new@b.com" } }));
    expect(delegate.create).toHaveBeenCalledWith({ data: { email: "new@b.com" } });

    await config.adapter.update(entry.ref, mutCtx({ id: "1", input: { email: "new@b.com" } }));
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { email: "new@b.com" },
    });

    await config.adapter.delete(entry.ref, mutCtx({ id: "1" }));
    expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("a missing model still fails on the delegate, not on name resolution", async () => {
    const config = defineAdmin({
      adapter: prismaAdapter({ prisma: {}, dmmf }),
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource("User", { columns: ["email"] })],
    });
    const ref = config.resourcesByName.get("User")?.ref;
    await expect(config.adapter.list(ref, listCtx)).rejects.toThrow(
      /no delegate found for model "User"/,
    );
  });
});
