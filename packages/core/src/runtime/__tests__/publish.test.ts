import { describe, expect, it, vi } from "vitest";
import { createPublisher } from "../publish.js";

describe("createPublisher (memory)", () => {
  it("fans out to subscribers of the channel", async () => {
    const pub = createPublisher({ driver: "memory" });
    const h = vi.fn();
    pub.subscribe("x", h);
    await pub.publish("x", { a: 1 });
    expect(h).toHaveBeenCalledWith({ a: 1 });
  });

  it("does not notify subscribers of other channels", async () => {
    const pub = createPublisher({ driver: "memory" });
    const hX = vi.fn();
    const hY = vi.fn();
    pub.subscribe("x", hX);
    pub.subscribe("y", hY);
    await pub.publish("x", 1);
    expect(hX).toHaveBeenCalledOnce();
    expect(hY).not.toHaveBeenCalled();
  });

  it("unsubscribe stops further notifications", async () => {
    const pub = createPublisher({ driver: "memory" });
    const h = vi.fn();
    const unsub = pub.subscribe("x", h);
    await pub.publish("x", 1);
    unsub();
    await pub.publish("x", 2);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("handles publishes to channels with no subscribers", async () => {
    const pub = createPublisher({ driver: "memory" });
    await expect(pub.publish("nobody")).resolves.toBeUndefined();
  });
});
