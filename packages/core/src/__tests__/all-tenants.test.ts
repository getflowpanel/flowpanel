import { describe, expect, it } from "vitest";
import { allTenants, isAllTenants } from "../all-tenants";
import { auditScopeKey } from "../runtime/audit-sql";

describe("allTenants", () => {
  it("is recognised only as itself, not as a copy or a look-alike", () => {
    expect(isAllTenants(allTenants)).toBe(true);
    expect(isAllTenants({ ...allTenants, region: "eu" })).toBe(false);
    expect(isAllTenants(Object.assign({}, allTenants))).toBe(false);
    expect(isAllTenants({ tenantId: "1" })).toBe(false);
    expect(isAllTenants(null)).toBe(false);
  });

  it("files nothing under a tenant", () => {
    expect(auditScopeKey(allTenants)).toBeNull();
  });
});
