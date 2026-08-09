import { subscribe } from "@flowpanel/next";
import { describe, expect, it, vi } from "vitest";
import { publish } from "../server.js";

describe("@flowpanel/kit/server publish shares the @flowpanel/next store", () => {
  it("a subscriber registered through the next runtime store receives a publish sent via the server subpath", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const received: unknown[] = [];
    const unsubscribe = subscribe("kit.server.publish", (payload) => received.push(payload));

    await publish("kit.server.publish", { hello: "world" });

    expect(received).toEqual([{ hello: "world" }]);
    unsubscribe();
  });
});
