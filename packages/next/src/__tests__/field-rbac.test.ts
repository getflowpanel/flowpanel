import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { filterActionsByRole, roleAllows } from "../runtime/action-helpers.js";
import { resolveFormFields } from "../runtime/resolve-form-fields.js";

const ctx = (role: string): RequestContext => ({ role, session: null }) as RequestContext;

describe("roleAllows", () => {
  it("allows when there is no requirement", () => {
    expect(roleAllows(undefined, ctx("guest"))).toBe(true);
  });

  it("checks a single role", () => {
    expect(roleAllows("admin", ctx("admin"))).toBe(true);
    expect(roleAllows("admin", ctx("guest"))).toBe(false);
  });

  it("checks a role list and a session predicate", () => {
    expect(roleAllows(["admin", "editor"], ctx("editor"))).toBe(true);
    expect(roleAllows(["admin", "editor"], ctx("viewer"))).toBe(false);
    expect(roleAllows(() => true, ctx("anyone"))).toBe(true);
    expect(roleAllows(() => false, ctx("anyone"))).toBe(false);
  });
});

describe("filterActionsByRole", () => {
  const actions = [
    { key: "open" },
    { key: "admin", requireRole: "admin" },
    { key: "staff", requireRole: ["admin", "support"] },
  ];

  it("keeps only actions the current operator may execute", () => {
    expect(filterActionsByRole(actions, ctx("support")).map((action) => action.key)).toEqual([
      "open",
      "staff",
    ]);
    expect(filterActionsByRole(actions, ctx("viewer")).map((action) => action.key)).toEqual([
      "open",
    ]);
  });
});

describe("resolveFormFields field-level RBAC", () => {
  const config = {
    adapter: { db: {} },
    resourcesByName: new Map(),
  } as unknown as ResolvedAdminConfig;

  it("drops fields the current role can't access", async () => {
    const fields = [{ name: "title" }, { name: "internalNote", requireRole: "admin" }];
    const asGuest = await resolveFormFields(config, fields, ctx("guest"));
    expect(asGuest.map((f) => f.name)).toEqual(["title"]);
    const asAdmin = await resolveFormFields(config, fields, ctx("admin"));
    expect(asAdmin.map((f) => f.name)).toEqual(["title", "internalNote"]);
  });
});
