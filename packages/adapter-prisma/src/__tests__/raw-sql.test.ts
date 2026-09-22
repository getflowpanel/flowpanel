import { describe, expect, it, vi } from "vitest";
import { prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";

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
        ],
      },
    ],
    enums: [],
  },
};

function client(rows: unknown[] = []) {
  const queryRaw = vi.fn().mockResolvedValue(rows);
  const count = vi.fn().mockResolvedValue(7);
  return { prisma: { $queryRaw: queryRaw, user: { count } }, queryRaw, count };
}

function adapterFor(rows: unknown[] = [], parseDates?: boolean) {
  const { prisma, queryRaw, count } = client(rows);
  const adapter = prismaAdapter({
    prisma,
    provider: "postgresql",
    dmmf,
    ...(parseDates === undefined ? {} : { parseDates }),
  });
  if (!adapter.sql || !adapter.count) throw new Error("fixture: capabilities missing");
  return { sql: adapter.sql, adapterCount: adapter.count, queryRaw, count };
}

describe("prismaAdapter sql capability", () => {
  it("hands $queryRaw the literals and the values apart, never interpolated", async () => {
    const { sql: query, queryRaw } = adapterFor();
    const hostile = "x'; drop table users; --";
    await query`select id from "User" where email = ${hostile} and n > ${3}`;
    const [strings, ...values] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect([...strings]).toEqual(['select id from "User" where email = ', " and n > ", ""]);
    expect(values).toEqual([hostile, 3]);
  });

  it("sanitises a Date and a bigint before binding them", async () => {
    const { sql: query, queryRaw } = adapterFor();
    await query`select 1 where at > ${new Date("2026-01-02T03:04:05.000Z")} and n = ${10n}`;
    const [, ...values] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual(["2026-01-02T03:04:05.000Z", "10"]);
  });

  it("reads a zoneless timestamp string in the result as UTC", async () => {
    const { sql: query } = adapterFor([{ at: "2026-01-02 03:04:05", label: "2026-01-02" }]);
    const [row] = await query<{ at: Date; label: string }>`select at, label from "User"`;
    expect((row?.at as Date).toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(row?.label).toBe("2026-01-02");
  });

  it("keeps the raw string when parseDates is off", async () => {
    const rows = [{ at: "2026-01-02 03:04:05" }];
    const { sql: query } = adapterFor(rows, false);
    expect(await query`select at from "User"`).toEqual(rows);
    const { sql: parsing } = adapterFor(rows, true);
    const [parsed] = await parsing<{ at: unknown }>`select at from "User"`;
    expect(parsed?.at).toBeInstanceOf(Date);
  });
});

describe("prismaAdapter count capability", () => {
  it("counts through the model delegate with no filter", async () => {
    const { adapterCount, count } = adapterFor();
    expect(await adapterCount("User")).toBe(7);
    expect(count).toHaveBeenCalledWith({ where: {} });
  });

  it("translates the same filter shapes list understands", async () => {
    const { adapterCount, count } = adapterFor();
    await adapterCount("User", {
      id: 3,
      deletedAt: "__null__",
      name: "__notnull__",
      age: { gte: 18 },
      role: { op: "in", values: ["a", "b"] },
      blank: "",
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        id: 3,
        deletedAt: null,
        name: { not: null },
        age: { gte: 18 },
        role: { in: ["a", "b"] },
      },
    });
  });
});
