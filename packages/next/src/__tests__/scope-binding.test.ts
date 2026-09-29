import type { RequestContext, ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { scopeBinding } from "../runtime/scope-binding";

function makeResource(scope: ResourceConfig["options"]["scope"]): ResourceConfig {
  return {
    __kind: "resource",
    ref: {},
    options: { columns: [], scope },
  } as unknown as ResourceConfig;
}

function makeReqCtx(scopeValue: RequestContext["scope"]): RequestContext {
  return {
    req: new Request("http://localhost/admin/users"),
    session: null,
    role: "admin",
    scope: scopeValue,
    ip: null,
    userAgent: null,
  };
}

describe("scopeBinding", () => {
  it("binds a function scope to the request's scope value", () => {
    const predicate = (s: unknown, q: unknown) => ({ ...(q as object), tenant: s });
    const resource = makeResource(predicate as ResourceConfig["options"]["scope"]);
    const binding = scopeBinding(resource, makeReqCtx({ companyId: "c1" }));
    expect(binding.boundScope?.kind).toBe("flowpanel.bound-scope");
    expect(binding.boundScope?.apply({ id: 1 })).toEqual({ id: 1, tenant: { companyId: "c1" } });
  });

  it("captures the request scope value (not a later mutation)", () => {
    const seen: unknown[] = [];
    const predicate = (s: unknown, q: unknown) => {
      seen.push(s);
      return q;
    };
    const resource = makeResource(predicate as ResourceConfig["options"]["scope"]);
    const binding = scopeBinding(resource, makeReqCtx({ companyId: "tenant-A" }));
    binding.boundScope?.apply({});
    expect(seen).toEqual([{ companyId: "tenant-A" }]);
  });

  it('"bypass" → nothing bound', () => {
    const binding = scopeBinding(makeResource("bypass"), makeReqCtx({ companyId: "c1" }));
    expect(binding.boundScope).toBeUndefined();
  });

  it("undefined scope → nothing bound", () => {
    const binding = scopeBinding(makeResource(undefined), makeReqCtx({ companyId: "c1" }));
    expect(binding.boundScope).toBeUndefined();
  });
});
