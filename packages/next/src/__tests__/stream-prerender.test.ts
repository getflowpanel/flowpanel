import type { ResolvedAdminConfig } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: () => new Promise<void>(() => {}),
}));
vi.mock("../runtime/publish", () => ({ bindPublisher: vi.fn(), subscribe: vi.fn() }));

import { stream } from "../stream";

describe("the realtime stream route at build time", () => {
  it("waits for a real request before it asks auth.session, so next build never runs the session", async () => {
    const session = vi.fn(async () => null);
    const config = {
      auth: { session, role: () => "guest" },
      resourcesByName: new Map(),
      realtime: { driver: "memory", channels: {} },
    } as unknown as ResolvedAdminConfig;
    void stream(config)(new Request("http://localhost/api/flowpanel/stream"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(session).not.toHaveBeenCalled();
  });
});
