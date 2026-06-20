import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { ResourceListPage } from "../pages/resource-list.js";

/**
 * Simulates a real Postgres driver: `list()` throws when `filters.status`
 * isn't one of the enum's declared labels — exactly the
 * `invalid input value for enum match_status: "pending"` crash from the bug
 * report. Lets these tests prove the fix at the page level, not just at the
 * `sanitizeFilterValues` unit.
 */
function mkAdapter(validStatuses: readonly string[]): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "matches", columns: [], primaryKey: "id" }),
    inferSchema: () =>
      ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
        Adapter["inferSchema"]
      >,
    list: async (_ref, ctx) => {
      const status = ctx.filters.status;
      if (typeof status === "string" && !validStatuses.includes(status)) {
        throw new Error(`invalid input value for enum match_status: "${status}"`);
      }
      return { rows: [{ id: "1", status: "confirmed" }], total: 1, page: 1, pageSize: 20 };
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

function mkConfig(adapter: Adapter) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "matches" },
        {
          columns: ["id", "status"],
          filters: [
            {
              field: "status",
              type: "select",
              options: [
                { label: "Needs review", value: "needs_review" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Rejected", value: "rejected" },
              ],
            },
          ],
        },
      ),
    ],
  });
}

describe("ResourceListPage — bogus filter value no longer crashes the page", () => {
  it("drops an out-of-range enum filter value instead of 500ing (reproduces ?f_status=pending)", async () => {
    const adapter = mkAdapter(["needs_review", "confirmed", "rejected"]);
    const config = mkConfig(adapter);
    const resourceCfg = config.resourcesByName.get("matches");
    if (!resourceCfg) throw new Error("matches resource not registered");

    await expect(
      ResourceListPage({
        config,
        resource: resourceCfg,
        searchParams: new URLSearchParams("f_status=pending"),
        req: new Request("http://localhost/admin/matches?f_status=pending"),
      }),
    ).resolves.toBeDefined();
  });

  it("still applies a valid enum filter value", async () => {
    const adapter = mkAdapter(["needs_review", "confirmed", "rejected"]);
    let seenFilters: Record<string, unknown> | undefined;
    const spyingAdapter: Adapter = {
      ...adapter,
      list: async (ref, ctx) => {
        seenFilters = ctx.filters;
        return adapter.list(ref, ctx);
      },
    };
    const config = mkConfig(spyingAdapter);
    const resourceCfg = config.resourcesByName.get("matches");
    if (!resourceCfg) throw new Error("matches resource not registered");

    await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams("f_status=confirmed"),
      req: new Request("http://localhost/admin/matches?f_status=confirmed"),
    });
    expect(seenFilters).toEqual({ status: "confirmed" });
  });
});
