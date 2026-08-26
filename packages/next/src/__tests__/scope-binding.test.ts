import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { scopeBinding } from "../runtime/scope-binding";

function makeConfig(hasGlobalScope: boolean): ResolvedAdminConfig {
  return {
    scope: hasGlobalScope ? () => ({ companyId: "c1" }) : undefined,
  } as unknown as ResolvedAdminConfig;
}

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
  it("function scope + global scope active → applyScope bound, scopeRequired true", () => {
    const config = makeConfig(true);
    const predicate = (s: unknown, q: unknown) => ({ ...(q as object), tenant: s });
    const resource = makeResource(predicate as ResourceConfig["options"]["scope"]);
    const reqCtx = makeReqCtx({ companyId: "c1" });

    const binding = scopeBinding(config, resource, reqCtx);
    expect(binding.scopeRequired).toBe(true);
    expect(typeof binding.applyScope).toBe("function");
    // The predicate receives the captured scope value as its first arg.
    expect(binding.applyScope?.({ id: 1 })).toEqual({ id: 1, tenant: { companyId: "c1" } });
  });

  it("captures the request scope value (not a later mutation)", () => {
    const config = makeConfig(true);
    const seen: unknown[] = [];
    const predicate = (s: unknown, q: unknown) => {
      seen.push(s);
      return q;
    };
    const resource = makeResource(predicate as ResourceConfig["options"]["scope"]);
    const reqCtx = makeReqCtx({ companyId: "tenant-A" });
    const binding = scopeBinding(config, resource, reqCtx);
    binding.applyScope?.({});
    expect(seen).toEqual([{ companyId: "tenant-A" }]);
  });

  it('"bypass" → no applyScope, scopeRequired false', () => {
    const config = makeConfig(true);
    const resource = makeResource("bypass");
    const binding = scopeBinding(config, resource, makeReqCtx({ companyId: "c1" }));
    expect(binding.applyScope).toBeUndefined();
    expect(binding.scopeRequired).toBe(false);
  });

  it("undefined scope → no applyScope, scopeRequired false", () => {
    const config = makeConfig(true);
    const resource = makeResource(undefined);
    const binding = scopeBinding(config, resource, makeReqCtx({ companyId: "c1" }));
    expect(binding.applyScope).toBeUndefined();
    expect(binding.scopeRequired).toBe(false);
  });

  it("no global scope → function scope is bound but NOT required", () => {
    const config = makeConfig(false);
    const predicate = (_s: unknown, q: unknown) => q;
    const resource = makeResource(predicate as ResourceConfig["options"]["scope"]);
    const binding = scopeBinding(config, resource, makeReqCtx(null));
    expect(typeof binding.applyScope).toBe("function");
    // scopeRequired is false when there's no global scope — fail-closed only
    // bites when the global scope is configured.
    expect(binding.scopeRequired).toBe(false);
  });
});
