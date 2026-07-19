import { describe, expect, it, vi } from "vitest";
import { prismaAdapter } from "../adapter.js";
import type { PrismaDmmf, PrismaDmmfField } from "../introspect.js";

function field(name: string, type: string, over: Partial<PrismaDmmfField> = {}): PrismaDmmfField {
  return {
    name,
    kind: "scalar",
    type,
    isId: false,
    isRequired: true,
    isUnique: false,
    isList: false,
    hasDefault: false,
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
  return { article: delegate, ticket: delegate, _delegate: delegate };
}

describe("prismaAdapter with a non-`id` primary key", () => {
  it("get queries by the model's @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf });

    await adapter.get("Article", { id: "hello-world", db: undefined } as never);

    expect(prisma._delegate.findUnique).toHaveBeenCalledWith({
      where: { slug: "hello-world" },
    });
  });

  it("update targets the @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf });

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
    const adapter = prismaAdapter({ prisma, dmmf });

    await adapter.delete?.("Article", { id: "hello-world", input: {}, db: undefined } as never);

    expect(prisma._delegate.delete).toHaveBeenCalledWith({ where: { slug: "hello-world" } });
  });

  it("soft delete and restore target the @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf });
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
    const adapter = prismaAdapter({ prisma, dmmf });

    await adapter.get("Ticket", { id: "42", db: undefined } as never);

    expect(prisma._delegate.findUnique).toHaveBeenCalledWith({ where: { ticketNo: 42 } });
  });

  it("still throws when the id cannot be coerced to a numeric @id field", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf });

    await expect(adapter.get("Ticket", { id: "abc", db: undefined } as never)).rejects.toThrow(
      /cannot coerce/,
    );
  });

  it("introspect reports the @id field as the primary key", () => {
    const adapter = prismaAdapter({ prisma: {}, dmmf });
    expect(adapter.introspect("Article").primaryKey).toBe("slug");
  });
});
