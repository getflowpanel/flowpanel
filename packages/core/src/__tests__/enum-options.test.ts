import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { defineAdmin, enumOf, resource } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: null,
  introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const Plan = enumOf({
  free: ["Free", "muted"],
  starter: ["Starter", "info"],
  pro: ["Pro", "accent"],
});
const PLAN_OPTIONS = [
  { label: "Free", value: "free" },
  { label: "Starter", value: "starter" },
  { label: "Pro", value: "pro" },
];

function users() {
  const config = defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id", { field: "plan", format: Plan.format }, "email"],
          filters: [
            { field: "plan", type: "select" },
            { field: "plan", type: "multiselect", options: [{ label: "Paid", value: "pro" }] },
            { field: "email", type: "select" },
            "email",
          ],
          update: { fields: [{ name: "plan", type: "radio" }, { name: "email" }] },
        },
      ),
    ],
  });
  const found = config.resourcesByName.get("users");
  if (!found) throw new Error("users is not registered");
  return found.options;
}

describe("select options from an enum's badge column", () => {
  it("fill a select filter that declares none, in declaration order", () => {
    expect(users().filters?.[0]).toEqual({ field: "plan", type: "select", options: PLAN_OPTIONS });
  });

  it("leave declared options, other columns and bare filters alone", () => {
    const filters = users().filters;
    expect(filters?.[1]).toEqual({
      field: "plan",
      type: "multiselect",
      options: [{ label: "Paid", value: "pro" }],
    });
    expect(filters?.[2]).toEqual({ field: "email", type: "select" });
    expect(filters?.[3]).toBe("email");
  });

  it("fill a choice form field, and only a choice field", () => {
    expect(users().update?.fields).toEqual([
      { name: "plan", type: "radio", options: PLAN_OPTIONS },
      { name: "email" },
    ]);
  });
});
