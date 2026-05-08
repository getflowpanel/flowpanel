import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (payload: unknown) => void;
const listeners = new Map<string, Set<Handler>>();

vi.mock("../runtime/publish.js", () => ({
  bindPublisher: vi.fn(),
  subscribe: vi.fn((channel: string, handler: Handler) => {
    let set = listeners.get(channel);
    if (!set) {
      set = new Set();
      listeners.set(channel, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
      if (set && set.size === 0) listeners.delete(channel);
    };
  }),
}));

function emit(channel: string, payload: unknown): void {
  for (const h of listeners.get(channel) ?? []) h(payload);
}

import { stream } from "../stream.js";

async function readChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  opts: { count: number; signal?: AbortSignal } = { count: 1 },
): Promise<string[]> {
  const decoder = new TextDecoder();
  const out: string[] = [];
  while (out.length < opts.count) {
    const { value, done } = await reader.read();
    if (done) break;
    out.push(decoder.decode(value));
    if (opts.signal?.aborted) break;
  }
  return out;
}

describe("stream() — SSE broker", () => {
  beforeEach(() => {
    listeners.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns text/event-stream headers with no-cache + X-Accel-Buffering", async () => {
    const h = stream({ realtime: { driver: "memory" } } as never);
    const req = new Request("http://localhost/stream");
    const res = await h(req);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
  });

  it("emits a 'ready' SSE event on connect", async () => {
    const h = stream({} as never);
    const req = new Request("http://localhost/stream");
    const res = await h(req);
    const reader = res.body!.getReader();
    const [first] = await readChunks(reader, { count: 1 });
    expect(first).toContain("event: ready");
    expect(first).toContain("data: {}");
    await reader.cancel();
  });

  it("subscribes to each ?channel and forwards JSON events", async () => {
    const h = stream({} as never);
    const req = new Request("http://localhost/stream?channel=resource.users&channel=custom");
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready

    // Trigger publish on first channel
    emit("resource.users", { action: "update", id: "7" });
    const [second] = await readChunks(reader, { count: 1 });
    expect(second).toMatch(/event: message/);
    expect(second).toMatch(/data: \{"action":"update","id":"7"\}/);

    // And the second channel
    emit("custom", { kind: "other" });
    const [third] = await readChunks(reader, { count: 1 });
    expect(third).toMatch(/event: message/);
    expect(third).toMatch(/data: \{"kind":"other"\}/);
    await reader.cancel();
  });

  it("sends a heartbeat comment at the configured interval", async () => {
    vi.useFakeTimers();
    const h = stream({} as never);
    const req = new Request("http://localhost/stream");
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready

    await vi.advanceTimersByTimeAsync(15_100);
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toMatch(/^: keep-alive\n\n/);
    await reader.cancel();
  });

  it("disposers fire when the request is aborted (disposer removes listener)", async () => {
    const h = stream({} as never);
    const ctrl = new AbortController();
    const req = new Request("http://localhost/stream?channel=foo", { signal: ctrl.signal });
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready
    expect(listeners.get("foo")?.size).toBe(1);
    ctrl.abort();
    // Give the abort handler time to run
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(listeners.get("foo") ?? new Set()).toEqual(new Set());
    await reader.cancel().catch(() => undefined);
  });

  it("emits empty payload for undefined events", async () => {
    const h = stream({} as never);
    const req = new Request("http://localhost/stream?channel=x");
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready
    emit("x", undefined);
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toMatch(/event: message\ndata: \n\n/);
    await reader.cancel();
  });
});
