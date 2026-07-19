import { describe, expect, it, vi } from "vitest";
import { MIGRATIONS_TABLE_DDL, prismaAdapter } from "../adapter.js";
import type { PrismaDmmf } from "../introspect.js";

const dmmf: PrismaDmmf = { datamodel: { models: [], enums: [] } };

function makeMockPrisma(rows: Array<{ id: string }> = []) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $queryRawUnsafe: vi.fn().mockResolvedValue(rows),
  };
}

describe("prismaAdapter migrations bookkeeping", () => {
  it("creates the bookkeeping table with dialect-portable DDL", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf });

    await adapter.listAppliedMigrations?.();

    const ddl = prisma.$executeRawUnsafe.mock.calls[0]?.[0] as string;
    expect(ddl).toBe(MIGRATIONS_TABLE_DDL);
    // `timestamptz` is rejected by mysql, `DEFAULT now()` by sqlite.
    expect(ddl).not.toMatch(/timestamptz/i);
    expect(ddl).not.toMatch(/DEFAULT\s+now\(\)/i);
    expect(ddl).toMatch(/DEFAULT CURRENT_TIMESTAMP/);
  });

  it("returns the applied ids", async () => {
    const prisma = makeMockPrisma([{ id: "0001_init" }, { id: "0002_posts" }]);
    const adapter = prismaAdapter({ prisma, dmmf });

    const applied = await adapter.listAppliedMigrations?.();

    expect(applied).toEqual(new Set(["0001_init", "0002_posts"]));
  });

  it("records an applied migration through a parameterized insert", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf });

    await adapter.markMigrationApplied?.("0003_orders");

    const [strings, ...values] = prisma.$executeRaw.mock.calls[0] as [string[], ...unknown[]];
    expect(strings.join("?")).toMatch(/INSERT INTO _flowpanel_migrations/);
    expect(values).toEqual(["0003_orders"]);
  });
});
