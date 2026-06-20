import type { ResolvedAdminConfig } from "@flowpanel/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deliberately NOT mocking "../runtime/publish.js" or "@flowpanel/core" here —
// this test exercises the REAL memory publisher end to end, the same way
// `stream.ts` and `apply-action-result.ts` do in production. Mocking the
// publisher would hide exactly the bug this test guards against (see below).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { applyActionResult } from "../runtime/apply-action-result.js";
import { bindPublisher, resetPublisherForTests } from "../runtime/publish.js";
import { stream } from "../stream.js";

function makeConfig(): ResolvedAdminConfig {
  return {
    auth: {
      session: async () => ({ user: { id: "u1", role: "admin" } }),
      role: () => "admin",
    },
    resourcesByName: new Map(),
    realtime: { driver: "memory" },
  } as unknown as ResolvedAdminConfig;
}

async function readOneMessage(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  // Skip non-"event: message" frames (e.g. the initial "ready" handshake).
  for (let i = 0; i < 10; i++) {
    const { value, done } = await reader.read();
    if (done) return "";
    const text = decoder.decode(value);
    if (text.startsWith("event: message")) return text;
  }
  return "";
}

/**
 * Regression test for the cross-tab realtime propagation bug: Next.js
 * compiles `stream/route.ts` and the `[...route]/route.ts` catch-all (which
 * dispatches to `drawerActionRoute`) into SEPARATE webpack bundles, each
 * re-evaluating `src/admin/config.ts` independently. The `ResolvedAdminConfig`
 * object passed to `stream(config)` is therefore NOT reference-equal to the
 * one passed to `drawerActionRoute(config)` / `applyActionResult`, even
 * though both represent the same logical admin config — confirmed by
 * instrumenting a real `next dev` server (see `runtime/publish.ts` for the
 * full account).
 *
 * `bindPublisher` used to rebind the shared publisher whenever it received a
 * config object it hadn't seen before, which silently swapped out the
 * publisher singleton on every cross-route request and orphaned any
 * `EventSource` already subscribed. This test simulates exactly that: two
 * DIFFERENT (but structurally identical) config objects, standing in for two
 * route bundles, drive the SSE connection and the mutation's publish
 * respectively.
 */
describe("realtime propagation across route bundles", () => {
  beforeEach(() => {
    resetPublisherForTests();
  });
  afterEach(() => {
    resetPublisherForTests();
  });

  it("an SSE subscriber opened via one config object receives events published via a different config object", async () => {
    const configFromStreamBundle = makeConfig();
    const configFromDrawerRouteBundle = makeConfig();
    expect(configFromStreamBundle).not.toBe(configFromDrawerRouteBundle);

    // Tab B: opens the SSE connection through `stream.ts`, exactly like
    // `<DataTable realtime="resource.users">` does via useLiveChannel.
    const streamHandler = stream(configFromStreamBundle);
    const res = await streamHandler(new Request("http://localhost/stream?channel=resource.users"));
    const reader = res.body!.getReader();
    await reader.read(); // "ready" handshake

    // Tab A: a drawer action succeeds. `drawerActionRoute(config)` binds the
    // publisher at factory time with ITS bundle-local config object before
    // ever calling `applyActionResult` — reproduce that ordering here.
    bindPublisher(configFromDrawerRouteBundle);
    await applyActionResult({ ok: true, refresh: true }, { resourceName: "users" });

    const message = await readOneMessage(reader);
    expect(message).toContain("event: message");
    expect(message).toContain('"action":"update"');

    await reader.cancel();
  });
});
