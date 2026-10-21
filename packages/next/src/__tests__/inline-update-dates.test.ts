import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import { type Adapter, defineAdmin, resource } from "@flowpanel/core";
import { z } from "zod";
import { inlineUpdateRoute } from "../actions/inline-update";

const written: { input?: Record<string, unknown> | undefined } = {};

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "orders",
    primaryKey: "id",
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "paidAt", type: "date", nullable: true, unique: false, primaryKey: false },
      {
        name: "dueOn",
        type: "date",
        nullable: true,
        unique: false,
        primaryKey: false,
        dateOnly: true,
      },
    ],
  }),
  inferSchema: () => ({
    create: z.object({}),
    update: z.object({
      paidAt: z.date().nullable().optional(),
      dueOn: z.date().nullable().optional(),
    }),
    select: z.object({}),
  }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
  get: async () => ({ id: "o1", paidAt: new Date("2026-10-18T22:25:00.000Z") }),
  create: async () => ({}),
  update: async (_ref, ctx) => {
    written.input = (ctx as { input: Record<string, unknown> }).input;
    return { id: "o1" };
  },
  delete: async () => undefined,
};

function route(timeZone?: string) {
  return inlineUpdateRoute(
    defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }), role: () => "admin", access: "admin" },
      ...(timeZone ? { formatting: { timeZone } } : {}),
      resources: [
        resource(
          { __name: "orders" },
          {
            columns: [
              { field: "paidAt", editable: true },
              { field: "dueOn", editable: true },
            ],
          },
        ),
      ],
    }),
  );
}

async function save(value: unknown, timeZone?: string, field = "paidAt") {
  const res = await route(timeZone)(
    new Request("http://localhost/api/flowpanel/orders/o1/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field, value }),
    }),
    { params: Promise.resolve({ resource: "orders", id: "o1" }) },
  );
  return { status: res.status, paidAt: written.input?.[field] };
}

describe("an inline edit of a timestamp", () => {
  beforeEach(() => {
    written.input = undefined;
  });

  it("reads the time the cell showed on the admin's clock, UTC until set", async () => {
    expect(await save("2026-10-18T22:30")).toEqual({
      status: 200,
      paidAt: new Date("2026-10-18T22:30:00.000Z"),
    });
  });

  it("reads it on a configured formatting.timeZone", async () => {
    expect((await save("2026-10-19T01:30", "Europe/Moscow")).paidAt).toEqual(
      new Date("2026-10-18T22:30:00.000Z"),
    );
  });

  it("keeps an ISO instant and an emptied cell as they are", async () => {
    expect((await save("2026-10-18T22:30:00.000Z", "Europe/Moscow")).paidAt).toEqual(
      new Date("2026-10-18T22:30:00.000Z"),
    );
    expect(await save(null)).toEqual({ status: 200, paidAt: null });
  });

  it("stores a calendar day as that day, whatever the admin's zone", async () => {
    expect(await save("2026-10-25", "America/New_York", "dueOn")).toEqual({
      status: 200,
      paidAt: new Date("2026-10-25T00:00:00.000Z"),
    });
  });
});
