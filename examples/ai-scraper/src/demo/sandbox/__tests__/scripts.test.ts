import { describe, expect, it } from "vitest";
import { CLEANUP_DEMO_HELP, RESET_DEMO_HELP } from "../script-help";

describe("sandbox operations CLI", () => {
  it("documents a local scoped reset by default", () => {
    expect(RESET_DEMO_HELP).toMatch(/--sandbox local/);
    expect(RESET_DEMO_HELP).toMatch(/only that sandbox/i);
    expect(RESET_DEMO_HELP).not.toMatch(/truncate/i);
  });

  it("documents forced expiry cleanup without global data claims", () => {
    expect(CLEANUP_DEMO_HELP).toMatch(/--force/);
    expect(CLEANUP_DEMO_HELP).toMatch(/expired sandboxes/i);
    expect(CLEANUP_DEMO_HELP).not.toMatch(/truncate/i);
  });
});
