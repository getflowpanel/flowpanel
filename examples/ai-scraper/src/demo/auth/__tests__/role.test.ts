import { describe, expect, it } from "vitest";
import { resolveDemoRole } from "../role";

describe("demo role", () => {
  it("accepts only admin and support", () => {
    expect(resolveDemoRole(null)).toBe("admin");
    expect(resolveDemoRole("flowpanel-demo-role=support")).toBe("support");
    expect(resolveDemoRole("flowpanel-demo-role=owner")).toBe("admin");
    expect(resolveDemoRole("flowpanel-demo-role=%00support")).toBe("admin");
  });
});
