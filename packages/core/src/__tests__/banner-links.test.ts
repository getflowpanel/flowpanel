import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { banner, dashboard, defineAdmin } from "../index";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as any, update: {} as any, select: {} as any }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

describe("banner", () => {
  it("is a full-width list with the banner variant", () => {
    expect(banner({ query: async () => [] })).toMatchObject({
      kind: "list",
      options: { span: 12, variant: "banner" },
    });
  });

  it("names a banner's more link that points nowhere", () => {
    expect(() =>
      defineAdmin({
        adapter: fakeAdapter,
        auth: { session: async () => null, role: () => "admin" },
        dashboards: [
          dashboard({
            path: "/",
            label: "Pulse",
            sections: [
              { widgets: [banner({ query: async () => [], more: { dashboard: "/sytem" } })] },
            ],
          }),
          dashboard({ path: "/system", label: "System", sections: [] }),
        ],
      }),
    ).toThrow(/options\.more names dashboard "\/sytem".*Did you mean "\/system"\?/s);
  });
});
