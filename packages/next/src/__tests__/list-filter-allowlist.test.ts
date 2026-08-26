import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ListQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { handlers } from "../handlers";

let seenFilters: Record<string, unknown> = {};

function makeAdapter(): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "users",
      columns: [
        { name: "id", type: "string", nullable: false, primary: true },
        { name: "email", type: "string", nullable: false },
        { name: "plan", type: "string", nullable: false },
        { name: "passwordHash", type: "string", nullable: false },
      ],
      primaryKey: "id",
    }),
    inferSchema: () => ({}) as never,
    list: async (_ref: unknown, ctx: ListQueryContext<unknown>) => {
      seenFilters = ctx.filters as Record<string, unknown>;
      return { rows: [], total: 0, page: 1, pageSize: 20 };
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  } as never;
}

const config = defineAdmin({
  adapter: makeAdapter(),
  auth: { session: async () => ({ userId: "u1" }), role: () => "admin" },
  resources: [
    resource(
      { __name: "users" } as never,
      {
        columns: ["email"],
        filters: ["plan"],
      } as never,
    ),
  ],
} as never) as never;

async function list(query: string): Promise<void> {
  seenFilters = {};
  await handlers(config).GET(new Request(`http://localhost/api/flowpanel/users${query}`), {
    params: Promise.resolve({ route: ["users"] }),
  });
}

describe("the JSON list endpoint only forwards declared filters", () => {
  it("forwards a declared filter", async () => {
    await list("?filter.plan=pro");
    expect(seenFilters).toEqual({ plan: "pro" });
  });

  it("forwards a filter declared only as a column", async () => {
    await list("?filter.email=a@b.c");
    expect(seenFilters).toEqual({ email: "a@b.c" });
  });

  it("drops an undeclared column so it cannot become an equality oracle", async () => {
    await list("?filter.passwordHash=guess");
    expect(seenFilters).toEqual({});
  });

  it("drops unknown fields entirely", async () => {
    await list("?filter.nope=1&filter.plan=pro");
    expect(seenFilters).toEqual({ plan: "pro" });
  });
});
