import { describe, expect, it, vi } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf, PrismaDmmfField } from "../introspect";

function field(name: string, type: string, over: Partial<PrismaDmmfField> = {}): PrismaDmmfField {
  return {
    name,
    kind: "scalar",
    type,
    isId: false,
    isRequired: true,
    isUnique: false,
    isList: false,
    hasDefaultValue: false,
    ...over,
  };
}

const dmmf: PrismaDmmf = {
  datamodel: {
    models: [
      {
        name: "Article",
        fields: [
          field("slug", "String", { isId: true, isUnique: true }),
          field("title", "String"),
          field("deletedAt", "DateTime", { isRequired: false }),
        ],
      },
      {
        name: "Ticket",
        fields: [field("ticketNo", "Int", { isId: true }), field("subject", "String")],
      },
      {
        name: "Membership",
        fields: [field("orgId", "String"), field("userId", "String"), field("role", "String")],
        primaryKey: { fields: ["orgId", "userId"] },
      },
    ],
    enums: [],
  },
};

function makeMockPrisma() {
  const delegate = {
    findMany: vi.fn(),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  return { article: delegate, ticket: delegate, membership: delegate, _delegate: delegate };
}

describe("prismaAdapter with a non-`id` primary key", () => {
  it("get queries by the model's @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await adapter.get("Article", { id: "hello-world", db: undefined } as never);

    expect(prisma._delegate.findUnique).toHaveBeenCalledWith({
      where: { slug: "hello-world" },
    });
  });

  it("update targets the @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await adapter.update("Article", {
      id: "hello-world",
      input: { title: "New" },
      db: undefined,
    } as never);

    expect(prisma._delegate.update).toHaveBeenCalledWith({
      where: { slug: "hello-world" },
      data: { title: "New" },
    });
  });

  it("delete targets the @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await adapter.delete?.("Article", { id: "hello-world", input: {}, db: undefined } as never);

    expect(prisma._delegate.delete).toHaveBeenCalledWith({ where: { slug: "hello-world" } });
  });

  it("soft delete and restore target the @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });
    const ctx = {
      id: "hello-world",
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
    } as never;

    await adapter.delete?.("Article", ctx);
    await adapter.restore?.("Article", ctx);

    for (const call of prisma._delegate.update.mock.calls) {
      expect(call[0].where).toEqual({ slug: "hello-world" });
    }
    expect(prisma._delegate.update).toHaveBeenCalledTimes(2);
  });

  it("coerces to the @id field's type under its own name", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await adapter.get("Ticket", { id: "42", db: undefined } as never);

    expect(prisma._delegate.findUnique).toHaveBeenCalledWith({ where: { ticketNo: 42 } });
  });

  it("reads an id that cannot be a numeric @id field as no row", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await expect(adapter.get("Ticket", { id: "abc", db: undefined } as never)).resolves.toBeNull();
  });

  it("introspect reports the @id field as the primary key", () => {
    const adapter = prismaAdapter({ prisma: {}, dmmf, provider: "postgresql" });
    expect(adapter.introspect("Article").primaryKey).toBe("slug");
  });
});

describe("prismaAdapter with an @@id composite key", () => {
  it("reports every key field and orders a stable list by all of them", async () => {
    const prisma = makeMockPrisma();
    prisma._delegate.findMany.mockResolvedValue([]);
    prisma._delegate.count.mockResolvedValue(0);
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });
    expect(adapter.introspect("Membership").keyColumns).toEqual(["orgId", "userId"]);

    await adapter.list("Membership", {
      filters: {},
      sort: { field: "role", dir: "desc" },
      tiebreak: ["orgId", "userId"],
      page: 1,
      pageSize: 10,
      search: "",
    } as never);
    expect(prisma._delegate.findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [{ role: "desc" }, { orgId: "asc" }, { userId: "asc" }],
    });
  });
});

describe("prismaAdapter sorting an optional field", () => {
  it("puts rows with no value last in both directions", async () => {
    const prisma = makeMockPrisma();
    prisma._delegate.findMany.mockResolvedValue([]);
    prisma._delegate.count.mockResolvedValue(0);
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });
    for (const dir of ["asc", "desc"] as const) {
      await adapter.list("Article", {
        filters: {},
        sort: { field: "deletedAt", dir },
        page: 1,
        pageSize: 10,
        search: "",
      } as never);
    }
    const orders = prisma._delegate.findMany.mock.calls.map((call) => call[0]?.orderBy);
    expect(orders).toEqual([
      [{ deletedAt: { sort: "asc", nulls: "last" } }],
      [{ deletedAt: { sort: "desc", nulls: "last" } }],
    ]);
  });
});
