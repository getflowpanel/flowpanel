import { describe, expect, it } from "vitest";
import { shouldRenderActionsBar } from "../pages/dashboard";

describe("shouldRenderActionsBar", () => {
  it("renders when there is at least one action and the bar is not hidden", () => {
    expect(shouldRenderActionsBar(1, undefined)).toBe(true);
    expect(shouldRenderActionsBar(1, false)).toBe(true);
    expect(shouldRenderActionsBar(5, undefined)).toBe(true);
  });

  it("does not render when actions are empty", () => {
    expect(shouldRenderActionsBar(0, undefined)).toBe(false);
    expect(shouldRenderActionsBar(0, false)).toBe(false);
    // Even if the caller explicitly hides the bar with zero actions, the
    // result must still be `false` (nothing to render either way).
    expect(shouldRenderActionsBar(0, true)).toBe(false);
  });

  it("does not render when hideActionsBar is true, regardless of action count", () => {
    expect(shouldRenderActionsBar(1, true)).toBe(false);
    expect(shouldRenderActionsBar(10, true)).toBe(false);
  });
});
