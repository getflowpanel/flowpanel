import { Decimal } from "@prisma/client/runtime/library";
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
        name: "Order",
        fields: [
          field("id", "Int", { isId: true }),
          field("total", "Decimal", { nativeType: ["Decimal", ["10", "2"]] }),
          field("rate", "Decimal"),
        ],
      },
    ],
    enums: [],
  },
};

const row = { id: 1, total: new Decimal("49.90"), rate: new Decimal("0.125") };

function adapterReturning() {
  const order = {
    findMany: vi.fn().mockResolvedValue([row]),
    findUnique: vi.fn().mockResolvedValue(row),
    findFirst: vi.fn(),
    count: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(row),
    update: vi.fn().mockResolvedValue(row),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
  return prismaAdapter({ prisma: { order }, dmmf, provider: "postgresql" });
}

describe("Prisma Decimal values", () => {
  it("reach the admin as strings at the column's scale", async () => {
    const adapter = adapterReturning();
    const listed = await adapter.list("Order", {
      filters: {},
      sort: null,
      page: 1,
      pageSize: 20,
      search: "",
    } as never);
    expect(listed.rows).toEqual([{ id: 1, total: "49.90", rate: "0.125" }]);
    expect(await adapter.get("Order", { id: "1" } as never)).toEqual({
      id: 1,
      total: "49.90",
      rate: "0.125",
    });
  });

  it("come back as strings from a create and an update", async () => {
    const adapter = adapterReturning();
    expect(await adapter.create("Order", { input: {} } as never)).toMatchObject({ total: "49.90" });
    expect(await adapter.update("Order", { id: "1", input: {} } as never)).toMatchObject({
      total: "49.90",
    });
  });
});
