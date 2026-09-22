import type { RequestContext, ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import {
  declaredDetailBaseFields,
  declaredDetailPolicyFields,
  declaredDrawerRowFields,
  declaredRowFields,
  projectAuthorizedRow,
} from "../runtime/project-row";

function resourceWith(options: Record<string, unknown>): ResourceConfig {
  return { __kind: "resource", ref: { __name: "r" }, options } as never;
}

describe("declaredRowFields", () => {
  it("unions string + ColumnDef columns and always includes rowKey", () => {
    const r = resourceWith({
      columns: ["id", "email", { field: "plan" }, { render: () => null }],
    });
    expect([...declaredRowFields(r)].sort()).toEqual(["email", "id", "plan"]);
  });

  it("adds the explicit rowKey when it isn't a declared column", () => {
    const r = resourceWith({ columns: ["email"], rowKey: "uuid" });
    expect(declaredRowFields(r)).toContain("uuid");
  });

  it("keeps drawer-only fields out of the list while declaring them for the drawer", () => {
    const r = resourceWith({
      columns: ["id"],
      drawer: {
        fields: ["email", "plan"],
        tabs: [
          { key: "profile", label: "Profile", fields: "*" },
          { key: "billing", label: "Billing", fields: ["cardLast4"] },
          { key: "orders", label: "Orders", resource: "orders" },
        ],
      },
    });
    expect([...declaredRowFields(r)]).toEqual(["id"]);
    const drawerFields = declaredDrawerRowFields(r);
    expect([...drawerFields].sort()).toEqual(["cardLast4", "email", "id", "plan"]);
    // "*" (the profile tab) must NOT expand the set to every DB column.
    expect(drawerFields.size).toBe(4);
  });

  it("keeps inactive detail fields out of base projection but resolves them for one policy decision", () => {
    const r = resourceWith({
      columns: ["id"],
      detail: {
        fields: ["bio"],
        tabs: [{ key: "extra", label: "Extra", fields: ["notes"] }],
      },
      create: { fields: [{ name: "email" }] },
      update: { fields: [{ name: "plan" }] },
    });
    expect([...declaredRowFields(r)]).toEqual(["id"]);
    expect([...declaredDetailBaseFields(r)].sort()).toEqual(["bio", "id"]);
    expect([...declaredDetailPolicyFields(r)].sort()).toEqual(["bio", "id", "notes"]);
  });

  it("never includes a field only present as raw adapter output — password hash stays undeclared", () => {
    const r = resourceWith({ columns: ["id", "email"] });
    expect(declaredRowFields(r).has("passwordHash")).toBe(false);
  });
});

describe("projectAuthorizedRow", () => {
  it("applies request-level field read policy before returning a client row", async () => {
    const protectedResource = resourceWith({
      columns: ["id", "email", "internalNote", "passwordHash"],
      fieldAccess: {
        internalNote: { read: "admin" },
        passwordHash: { sensitive: true },
      },
    });
    const reqCtx = {
      req: new Request("http://localhost/admin/users"),
      session: { id: "u1" },
      role: "operator",
      scope: null,
      ip: null,
      userAgent: null,
    } satisfies RequestContext;

    await expect(
      projectAuthorizedRow(
        protectedResource,
        { id: "1", email: "a@b.co", internalNote: "private", passwordHash: "secret" },
        reqCtx,
      ),
    ).resolves.toEqual({ id: "1", email: "a@b.co" });
  });
});
