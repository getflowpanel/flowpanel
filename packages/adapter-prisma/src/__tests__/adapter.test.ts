import { describe, expect, it, vi } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";

// Minimal DMMF for User model
const testDmmf: PrismaDmmf = {
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
            hasDefaultValue: true,
          },
          {
            name: "email",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: true,
            isUnique: true,
            isList: false,
            hasDefaultValue: false,
          },
          {
            name: "name",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: false,
            isUnique: false,
            isList: false,
            hasDefaultValue: false,
          },
          {
            name: "active",
            kind: "scalar",
            type: "Boolean",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefaultValue: true,
          },
          {
            name: "deletedAt",
            kind: "scalar",
            type: "DateTime",
            isId: false,
            isRequired: false,
            isUnique: false,
            isList: false,
            hasDefaultValue: false,
          },
        ],
      },
    ],
    enums: [],
  },
};

function makeMockPrisma() {
  const delegate = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
  return { user: delegate, _delegate: delegate };
}

// Cast to any — tests only exercise the fields the adapter actually reads
const baseCtx: any = {
  page: 1,
  pageSize: 10,
  filters: {},
  search: undefined,
  sort: undefined,
  softDelete: undefined,
  db: undefined,
};

describe("prismaAdapter", () => {
  it("reads through its own client and writes through the context database", async () => {
    const root = makeMockPrisma();
    root._delegate.findMany.mockResolvedValue([{ id: 1, name: "root-list" }]);
    root._delegate.count.mockResolvedValue(1);
    root._delegate.findUnique.mockResolvedValue({ id: 1, name: "root-get" });
    root._delegate.create.mockResolvedValue({ id: 1, name: "root-create" });
    root._delegate.update.mockResolvedValue({ id: 1, name: "root-update" });
    root._delegate.delete.mockResolvedValue({ id: 1 });

    const tx = makeMockPrisma();
    tx._delegate.create.mockResolvedValue({ id: 1, name: "tx-create" });
    tx._delegate.update
      .mockResolvedValueOnce({ id: 1, name: "tx-update" })
      .mockResolvedValueOnce({ id: 1, deletedAt: null });
    tx._delegate.delete.mockResolvedValue({ id: 1 });

    const adapter = prismaAdapter({ prisma: root, dmmf: testDmmf, provider: "postgresql" });

    const listed = await adapter.list("User", baseCtx);
    const found = await adapter.get("User", { id: "1" } as any);
    const created = await adapter.create("User", { input: { name: "new" }, db: tx } as any);
    const updated = await adapter.update("User", {
      id: "1",
      input: { name: "changed" },
      db: tx,
    } as any);
    await adapter.delete!("User", { id: "1", input: {}, db: tx } as any);
    await adapter.restore!("User", {
      id: "1",
      input: {},
      softDelete: { column: "deletedAt" },
      db: tx,
    } as any);

    expect(listed.rows).toEqual([{ id: 1, name: "root-list" }]);
    expect(found).toEqual({ id: 1, name: "root-get" });
    expect(created).toEqual({ id: 1, name: "tx-create" });
    expect(updated).toEqual({ id: 1, name: "tx-update" });
    expect(tx._delegate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(tx._delegate.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { deletedAt: null },
    });
    expect(tx._delegate.findMany).not.toHaveBeenCalled();
    expect(tx._delegate.findUnique).not.toHaveBeenCalled();
    expect(root._delegate.create).not.toHaveBeenCalled();
    expect(root._delegate.update).not.toHaveBeenCalled();
    expect(root._delegate.delete).not.toHaveBeenCalled();
  });

  it("answers a missing row on update with null and on delete with nothing, like Drizzle", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    const missing = Object.assign(new Error("Record to update not found."), { code: "P2025" });
    _delegate.update.mockRejectedValue(missing);
    _delegate.delete.mockRejectedValue(missing);
    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await expect(
      adapter.update("User", { ...baseCtx, id: "1", input: { email: "x" } }),
    ).resolves.toBeNull();
    await expect(
      adapter.delete("User", { ...baseCtx, id: "1", input: {} }),
    ).resolves.toBeUndefined();
    await expect(
      adapter.delete("User", {
        ...baseCtx,
        id: "1",
        input: {},
        softDelete: { column: "deletedAt" },
      }),
    ).resolves.toBeUndefined();
  });

  it("keeps a P2025 from a nested connect, which is not the row going missing", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.update.mockRejectedValue(
      Object.assign(new Error("No 'Team' record found for a nested connect."), {
        code: "P2025",
        meta: {
          cause:
            "No 'Team' record(s) (needed to inline the relation) was found for a nested connect.",
        },
      }),
    );
    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await expect(adapter.update("User", { ...baseCtx, id: "1", input: {} })).rejects.toThrow(
      "nested connect",
    );
    _delegate.update.mockRejectedValue(
      Object.assign(new Error("gone"), {
        code: "P2025",
        meta: { cause: "Record to update not found." },
      }),
    );
    await expect(adapter.update("User", { ...baseCtx, id: "1", input: {} })).resolves.toBeNull();
  });

  it("still throws any other Prisma error from an update", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.update.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }));
    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await expect(adapter.update("User", { ...baseCtx, id: "1", input: {} })).rejects.toThrow(
      "Unique",
    );
  });

  it("list returns rows and total", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([{ id: 1, email: "a@b.com" }]);
    _delegate.count.mockResolvedValue(1);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    const result = await adapter.list("User", baseCtx);

    expect(result.rows).toEqual([{ id: 1, email: "a@b.com" }]);
    expect(result.total).toBe(1);
  });

  it("list applies equality filter via where", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", { ...baseCtx, filters: { email: "alice@example.com" } });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ email: "alice@example.com" }) }),
    );
  });

  it("passes numbers to Prisma for an Int field filtered by strings, as reference lookups and URLs send them", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);
    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", {
      ...baseCtx,
      filters: { id: { op: "in", values: ["1", "2", "x"] }, email: "7" },
    });
    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1, 2, "x"] }, email: "7" } }),
    );
    await adapter.count?.("User", { id: "3" });
    expect(_delegate.count).toHaveBeenLastCalledWith({ where: { id: 3 } });
  });

  it("list search restricts OR to the declared searchFields only", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", { ...baseCtx, search: "alice", searchFields: ["name"] });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ name: { contains: "alice", mode: "insensitive" } }],
        }),
      }),
    );
  });

  it("list search omits `mode` off PostgreSQL — Prisma rejects it there", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "sqlite",
    });
    await adapter.list("User", { ...baseCtx, search: "alice", searchFields: ["name"] });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ name: { contains: "alice" } }] }),
      }),
    );
  });

  it("FAIL-CLOSED: list search has no effect when searchFields is undeclared", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    // A hand-crafted `?search=` on a resource with no declared search fields
    // must not become a data oracle across every string column.
    await adapter.list("User", { ...baseCtx, search: "alice" });

    const where = _delegate.findMany.mock.calls[0]![0].where;
    expect(where.OR).toBeUndefined();
  });

  it("list translates __null__ sentinel to where[field] = null", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", { ...baseCtx, filters: { name: "__null__" } });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: null }) }),
    );
  });

  it("list translates __notnull__ sentinel to where[field] = { not: null }", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", { ...baseCtx, filters: { name: "__notnull__" } });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: { not: null } }) }),
    );
  });

  it("get returns row or null", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findUnique.mockResolvedValueOnce({ id: 1 });
    _delegate.findUnique.mockResolvedValueOnce(null);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });

    const row = await adapter.get("User", { id: "1", db: undefined } as any);
    expect(row).toEqual({ id: 1 });

    const notFound = await adapter.get("User", { id: "999", db: undefined } as any);
    expect(notFound).toBeNull();
  });

  it("create returns inserted row", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    const newUser = { id: 2, email: "new@example.com", active: true };
    _delegate.create.mockResolvedValue(newUser);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    const result = await adapter.create("User", {
      input: { email: "new@example.com", active: true },
      db: undefined,
    } as any);

    expect(result).toEqual(newUser);
    expect(_delegate.create).toHaveBeenCalledWith({
      data: { email: "new@example.com", active: true },
    });
  });

  it("update by id", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    const updated = { id: 1, email: "updated@example.com", active: true };
    _delegate.update.mockResolvedValue(updated);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    const result = await adapter.update("User", {
      id: "1",
      input: { email: "updated@example.com" },
      db: undefined,
    } as any);

    expect(result).toEqual(updated);
    expect(_delegate.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { email: "updated@example.com" },
    });
  });

  it("hard delete (no softDelete) calls delegate.delete", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.delete.mockResolvedValue({});

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.delete!("User", { id: "1", input: {}, db: undefined } as any);

    expect(_delegate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(_delegate.update).not.toHaveBeenCalled();
  });

  it("soft delete sets {[col]: new Date()} when ctx.softDelete set", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.update.mockResolvedValue({});

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    const before = Date.now();
    await adapter.delete!("User", {
      id: "1",
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
    } as any);
    const after = Date.now();

    expect(_delegate.delete).not.toHaveBeenCalled();
    expect(_delegate.update).toHaveBeenCalledOnce();
    const callArgs = _delegate.update.mock.calls[0]![0];
    expect(callArgs.where).toEqual({ id: 1 });
    const deletedAtTime = callArgs.data.deletedAt.getTime();
    expect(deletedAtTime).toBeGreaterThanOrEqual(before);
    expect(deletedAtTime).toBeLessThanOrEqual(after);
  });

  it("list excludes soft-deleted rows by adding where[col]=null", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", { ...baseCtx, softDelete: { column: "deletedAt" } });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it("list with softDelete + includeDeleted:true skips the where[col]=null exclusion", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", {
      ...baseCtx,
      softDelete: { column: "deletedAt" },
      includeDeleted: true,
    });

    const where = _delegate.findMany.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("deletedAt");
  });

  it("list with softDelete + includeDeleted:false (fail-safe default) still excludes", async () => {
    const { user: delegate, _delegate } = makeMockPrisma();
    _delegate.findMany.mockResolvedValue([]);
    _delegate.count.mockResolvedValue(0);

    const adapter = prismaAdapter({
      prisma: { user: delegate },
      dmmf: testDmmf,
      provider: "postgresql",
    });
    await adapter.list("User", {
      ...baseCtx,
      softDelete: { column: "deletedAt" },
      includeDeleted: false,
    });

    expect(_delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it("reads an id that cannot be a numeric PK as no row, and refuses to write it", async () => {
    const prisma = makeMockPrisma();
    const a = prismaAdapter({ prisma: prisma as any, dmmf: testDmmf, provider: "postgresql" });
    await expect(a.get("User", { id: "not-a-number", db: undefined } as any)).resolves.toBeNull();
    await expect(
      a.update("User", { id: "not-a-number", input: {}, db: undefined } as any),
    ).rejects.toThrow(/cannot coerce/);
  });

  it("reads Prisma's malformed-id error P2023 as no row", async () => {
    const prisma = makeMockPrisma();
    prisma._delegate.findUnique.mockRejectedValueOnce(
      Object.assign(new Error("Inconsistent column data"), { code: "P2023" }),
    );
    const a = prismaAdapter({ prisma: prisma as any, dmmf: testDmmf, provider: "postgresql" });
    await expect(a.get("User", { id: "1", db: undefined } as any)).resolves.toBeNull();
  });

  it("introspect delegates to introspect module", () => {
    const adapter = prismaAdapter({ prisma: {}, dmmf: testDmmf, provider: "postgresql" });
    const result = adapter.introspect("User");
    expect(result.name).toBe("User");
    expect(result.primaryKey).toBe("id");
  });

  it("inferSchema delegates to schema module", () => {
    const adapter = prismaAdapter({ prisma: {}, dmmf: testDmmf, provider: "postgresql" });
    const schemas = adapter.inferSchema("User");
    expect(schemas.create).toBeDefined();
    expect(schemas.update).toBeDefined();
    expect(schemas.select).toBeDefined();
  });
});
