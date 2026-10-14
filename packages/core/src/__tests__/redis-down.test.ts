import { describe, expect, it, vi } from "vitest";
import { createPublisher } from "../runtime/worker-publisher";

describe("a worker's publisher with Redis down", () => {
  it("resolves within seconds and hands the error to onError", async () => {
    const onError = vi.fn();
    const events = createPublisher({ redis: "redis://127.0.0.1:1", keyPrefix: "down", onError });
    const started = Date.now();
    await expect(events.resource("orders", { id: 1 })).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toBe("resource.orders");
    await events.close();
  }, 15_000);
});
