import { describe, expect, it } from "vitest";
import { bullmqAdapter } from "../adapter.js";

describe("bullmqAdapter", () => {
  it("returns { kind, queues } wrapper", () => {
    const fakeQueue = { name: "x" } as never;
    const a = bullmqAdapter({ scraper: fakeQueue });
    expect(a.kind).toBe("bullmq");
    expect(a.queues.scraper).toBe(fakeQueue);
  });
});
