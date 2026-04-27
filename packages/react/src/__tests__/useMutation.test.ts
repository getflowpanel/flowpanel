import { describe, expect, it, vi } from "vitest";
import { broadcastInvalidation, subscribeToInvalidation } from "../hooks/useMutation";

describe("invalidation bus", () => {
  it("listeners receive broadcast tags", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeToInvalidation(cb);
    broadcastInvalidation("resource.user");
    expect(cb).toHaveBeenCalledWith("resource.user");
    unsubscribe();
  });

  it("unsubscribe stops further calls", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeToInvalidation(cb);
    unsubscribe();
    broadcastInvalidation("x");
    expect(cb).not.toHaveBeenCalled();
  });

  it("multiple listeners each get the event", () => {
    const a = vi.fn();
    const b = vi.fn();
    const u1 = subscribeToInvalidation(a);
    const u2 = subscribeToInvalidation(b);
    broadcastInvalidation("tag");
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    u1();
    u2();
  });
});
