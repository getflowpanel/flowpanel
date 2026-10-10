import { createRequire } from "node:module";
import type { MutationContext } from "@flowpanel/core";
import { bindAdapterScope, FlowpanelAccessError } from "@flowpanel/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../adapter";

const require = createRequire(import.meta.url);

interface TestClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $executeRawUnsafe(sql: string): Promise<number>;
  testItem: {
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
  };
}

let generated: { PrismaClient: new (opts: unknown) => TestClient; Prisma: { dmmf: unknown } };
let clientGenerated = false;
try {
  generated = require("../../node_modules/.prisma/test-client");
  clientGenerated = true;
} catch {}

const equalityC1 = (where: unknown): unknown => ({ ...(where as object), companyId: "c1" });
const filterC1 = (where: unknown): unknown => ({
  ...(where as object),
  companyId: { in: ["c1", "c1-archive"] },
});

function mutCtx(
  id: string,
  input: Record<string, unknown>,
  scope: (where: unknown) => unknown,
): MutationContext<unknown> {
  return {
    req: new Request("http://localhost/admin/items"),
    session: null,
    role: "admin",
    scope: { companyId: "c1" },
    ip: null,
    userAgent: null,
    db: undefined,
    id,
    input,
    boundScope: bindAdapterScope(scope),
  } as MutationContext<unknown>;
}

describe.skipIf(!clientGenerated)("prismaAdapter write scope — SQLite integration", () => {
  let prisma: TestClient;
  let adapter: ReturnType<typeof prismaAdapter>;

  beforeAll(async () => {
    prisma = new generated.PrismaClient({
      datasources: { db: { url: "file::memory:?cache=shared" } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "TestItem" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "companyId" TEXT NOT NULL)`,
    );
    await prisma.$executeRawUnsafe(`DELETE FROM "TestItem"`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TestItem" ("id", "name", "companyId") VALUES ('i1', 'Before', 'c1'), ('i2', 'Other', 'c2')`,
    );
    adapter = prismaAdapter({ prisma, dmmf: generated.Prisma.dmmf as never, provider: "sqlite" });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("SECURITY: update that sets the tenant column to another tenant is refused and the row is unchanged", async () => {
    await expect(
      adapter.update("TestItem", mutCtx("i1", { name: "After", companyId: "c2" }, equalityC1)),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
    expect(await prisma.testItem.findUnique({ where: { id: "i1" } })).toEqual({
      id: "i1",
      name: "Before",
      companyId: "c1",
    });
  });

  it("SECURITY: a filter-shaped scope rolls the move back inside the transaction", async () => {
    await expect(
      adapter.update("TestItem", mutCtx("i1", { name: "After", companyId: "c2" }, filterC1)),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
    expect(await prisma.testItem.findUnique({ where: { id: "i1" } })).toEqual({
      id: "i1",
      name: "Before",
      companyId: "c1",
    });
  });

  it("update inside the scope succeeds, and an out-of-scope id is not found", async () => {
    expect(
      await adapter.update(
        "TestItem",
        mutCtx("i1", { name: "After", companyId: "c1" }, equalityC1),
      ),
    ).toEqual({ id: "i1", name: "After", companyId: "c1" });
    expect(await adapter.update("TestItem", mutCtx("i2", { name: "Hacked" }, filterC1))).toBeNull();
    expect(await prisma.testItem.findUnique({ where: { id: "i2" } })).toMatchObject({
      name: "Other",
    });
  });
});
