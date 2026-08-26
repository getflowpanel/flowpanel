import { describe, expect, it } from "vitest";
import { RouteNameRegistry } from "../compiler/route-graph";

describe("RouteNameRegistry", () => {
  it("rejects names that are not one safe URL segment", () => {
    const routes = new RouteNameRegistry();

    expect(() => routes.add("resource", "customer/orders")).toThrow(/safe ASCII route identifier/i);
  });
});
