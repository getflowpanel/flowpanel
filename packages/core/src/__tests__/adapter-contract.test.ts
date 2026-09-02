import { describe, expect, it } from "vitest";
import { bindAdapterScope } from "../types/bound-scope";

describe("adapter v2 contract", () => {
  it("creates an immutable opaque bound scope", () => {
    const scope = bindAdapterScope((query) => ({ query, tenantId: "t1" }));
    expect(scope.kind).toBe("flowpanel.bound-scope");
    expect(scope.apply({ id: "1" })).toEqual({ query: { id: "1" }, tenantId: "t1" });
    expect(Object.isFrozen(scope)).toBe(true);
  });
});
