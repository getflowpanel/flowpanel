import { FlowpanelAccessError } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { prismaAdapter } from "../adapter.js";
import type { PrismaDmmf } from "../introspect.js";

const dmmf: PrismaDmmf = {
  datamodel: {
    models: [
      {
        name: "Item",
        fields: [
          {
            name: "id",
            kind: "scalar",
            type: "String",
            isId: true,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefault: true,
          },
          {
            name: "companyId",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefault: false,
          },
        ],
      },
    ],
    enums: [],
  },
};

function makeMock() {
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
  return { item: delegate, _d: delegate };
}

// Spec-shaped prisma scope predicate: merge tenant keys into the where object.
const applyScopeC1 = (where: unknown): unknown => ({
  ...(where as object),
  companyId: "c1",
});

const baseCtx: Record<string, unknown> = {
  page: 1,
  pageSize: 10,
  filters: {},
  search: undefined,
  sort: undefined,
  db: undefined,
};

describe("prismaAdapter tenant scope enforcement", () => {
  it("list merges scope keys into where (and count)", async () => {
    const { item, _d } = makeMock();
    _d.findMany.mockResolvedValue([]);
    _d.count.mockResolvedValue(0);
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await adapter.list("Item", {
      ...baseCtx,
      filters: { name: "A" },
      applyScope: applyScopeC1,
      scopeRequired: true,
    } as never);

    expect(_d.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "A", companyId: "c1" } }),
    );
    expect(_d.count).toHaveBeenCalledWith({ where: { name: "A", companyId: "c1" } });
  });

  it("get uses findFirst with merged scope; out-of-scope returns null", async () => {
    const { item, _d } = makeMock();
    _d.findFirst.mockResolvedValue(null);
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    const row = await adapter.get("Item", {
      id: "i3",
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(row).toBeNull();
    expect(_d.findFirst).toHaveBeenCalledWith({ where: { id: "i3", companyId: "c1" } });
    expect(_d.findUnique).not.toHaveBeenCalled();
  });

  it("update uses updateMany with merged scope; 0-count out-of-scope returns null", async () => {
    const { item, _d } = makeMock();
    _d.updateMany.mockResolvedValue({ count: 0 });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    const result = await adapter.update("Item", {
      id: "i3",
      input: { name: "HACK" },
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(result).toBeNull();
    expect(_d.updateMany).toHaveBeenCalledWith({
      where: { id: "i3", companyId: "c1" },
      data: { name: "HACK" },
    });
    expect(_d.update).not.toHaveBeenCalled();
  });

  it("update in-scope returns the re-read row", async () => {
    const { item, _d } = makeMock();
    _d.updateMany.mockResolvedValue({ count: 1 });
    _d.findFirst.mockResolvedValue({ id: "i1", companyId: "c1", name: "A2" });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    const result = await adapter.update("Item", {
      id: "i1",
      input: { name: "A2" },
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(result).toEqual({ id: "i1", companyId: "c1", name: "A2" });
  });

  it("delete uses deleteMany with merged scope", async () => {
    const { item, _d } = makeMock();
    _d.deleteMany.mockResolvedValue({ count: 0 });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await adapter.delete!("Item", {
      id: "i3",
      input: {},
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(_d.deleteMany).toHaveBeenCalledWith({ where: { id: "i3", companyId: "c1" } });
    expect(_d.delete).not.toHaveBeenCalled();
  });

  it("soft delete uses updateMany with merged scope when applyScope set", async () => {
    const { item, _d } = makeMock();
    _d.updateMany.mockResolvedValue({ count: 0 });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await adapter.delete!("Item", {
      id: "i3",
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(_d.updateMany).toHaveBeenCalledOnce();
    const args = _d.updateMany.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "i3", companyId: "c1" });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(_d.update).not.toHaveBeenCalled();
  });

  it("restore uses updateMany with merged scope; out-of-scope affects 0 rows", async () => {
    const { item, _d } = makeMock();
    _d.updateMany.mockResolvedValue({ count: 0 });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await adapter.restore!("Item", {
      id: "i3",
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(_d.updateMany).toHaveBeenCalledWith({
      where: { id: "i3", companyId: "c1" },
      data: { deletedAt: null },
    });
    expect(_d.update).not.toHaveBeenCalled();
  });

  it("restore (unscoped) keeps the update fast path", async () => {
    const { item, _d } = makeMock();
    _d.update.mockResolvedValue({ id: "i1" });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await adapter.restore!("Item", {
      id: "i1",
      input: {},
      softDelete: { column: "deletedAt" },
      db: undefined,
    } as never);

    expect(_d.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { deletedAt: null } });
    expect(_d.updateMany).not.toHaveBeenCalled();
  });

  it("FAIL-CLOSED: restore throws when scopeRequired && no applyScope", async () => {
    const { item } = makeMock();
    const adapter = prismaAdapter({ prisma: { item }, dmmf });
    await expect(
      adapter.restore!("Item", {
        id: "i1",
        input: {},
        softDelete: { column: "deletedAt" },
        db: undefined,
        scopeRequired: true,
      } as never),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("FAIL-CLOSED: list throws when scopeRequired && no applyScope", async () => {
    const { item } = makeMock();
    const adapter = prismaAdapter({ prisma: { item }, dmmf });
    await expect(
      adapter.list("Item", { ...baseCtx, scopeRequired: true } as never),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("FAIL-CLOSED: get throws when scopeRequired && no applyScope", async () => {
    const { item } = makeMock();
    const adapter = prismaAdapter({ prisma: { item }, dmmf });
    await expect(
      adapter.get("Item", { id: "i1", db: undefined, scopeRequired: true } as never),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("FAIL-CLOSED: update throws when scopeRequired && no applyScope", async () => {
    const { item } = makeMock();
    const adapter = prismaAdapter({ prisma: { item }, dmmf });
    await expect(
      adapter.update("Item", {
        id: "i1",
        input: { name: "x" },
        db: undefined,
        scopeRequired: true,
      } as never),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("FAIL-CLOSED: delete throws when scopeRequired && no applyScope", async () => {
    const { item } = makeMock();
    const adapter = prismaAdapter({ prisma: { item }, dmmf });
    await expect(
      adapter.delete!("Item", {
        id: "i1",
        input: {},
        db: undefined,
        scopeRequired: true,
      } as never),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
  });

  it("create merges the resolved scope into insert data, overriding client input", async () => {
    const { item, _d } = makeMock();
    _d.create.mockResolvedValue({ id: "new1", companyId: "c1", name: "New" });
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    // Attacker-controlled input hand-crafts a row for a DIFFERENT tenant.
    await adapter.create("Item", {
      input: { name: "New", companyId: "c2" },
      db: undefined,
      applyScope: applyScopeC1,
    } as never);

    expect(_d.create).toHaveBeenCalledWith({
      data: { name: "New", companyId: "c1" },
    });
  });

  it("FAIL-CLOSED: create throws when scopeRequired && no applyScope", async () => {
    const { item, _d } = makeMock();
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await expect(
      adapter.create("Item", {
        input: { name: "New" },
        db: undefined,
        scopeRequired: true,
      } as never),
    ).rejects.toBeInstanceOf(FlowpanelAccessError);
    expect(_d.create).not.toHaveBeenCalled();
  });

  it("no scope (unscoped) keeps findUnique / update / delete fast paths", async () => {
    const { item, _d } = makeMock();
    _d.findUnique.mockResolvedValue({ id: "i1" });
    _d.update.mockResolvedValue({ id: "i1" });
    _d.delete.mockResolvedValue({});
    const adapter = prismaAdapter({ prisma: { item }, dmmf });

    await adapter.get("Item", { id: "i1", db: undefined } as never);
    expect(_d.findUnique).toHaveBeenCalledWith({ where: { id: "i1" } });

    await adapter.update("Item", { id: "i1", input: {}, db: undefined } as never);
    expect(_d.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: {} });

    await adapter.delete!("Item", { id: "i1", input: {}, db: undefined } as never);
    expect(_d.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
  });
});
