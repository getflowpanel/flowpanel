import type { ResolvedAdminConfig } from "@flowpanel/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DECLARED = Object.fromEntries(
  [
    "custom",
    "foo",
    "x",
    "other",
    "ok-channel",
    ...Array.from({ length: 40 }, (_, i) => `ch-${i}`),
  ].map((name) => [name, {}]),
);

function makeConfig(overrides: Partial<ResolvedAdminConfig> = {}): ResolvedAdminConfig {
  return {
    auth: {
      session: async () => ({ user: { id: "u1", role: "admin" } }),
      role: () => "admin",
    },
    resourcesByName: new Map([["users", { __kind: "resource", ref: {}, options: {} }]]),
    realtime: { driver: "memory", channels: DECLARED },
    ...overrides,
  } as ResolvedAdminConfig;
}

type Handler = (payload: unknown) => void;
const listeners = new Map<string, Set<Handler>>();

vi.mock("../runtime/publish", () => ({
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

import { stream } from "../stream";

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
    const h = stream(makeConfig({ realtime: { driver: "memory" } }));
    const req = new Request("http://localhost/stream");
    const res = await h(req);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
  });

  it("emits a 'ready' SSE event on connect", async () => {
    const h = stream(makeConfig());
    const req = new Request("http://localhost/stream");
    const res = await h(req);
    const reader = res.body!.getReader();
    const [first] = await readChunks(reader, { count: 1 });
    expect(first).toContain("event: ready");
    expect(first).toContain("data: {}");
    await reader.cancel();
  });

  it("subscribes to each ?channel and forwards JSON events", async () => {
    const h = stream(makeConfig());
    const req = new Request("http://localhost/stream?channel=resource.users&channel=custom");
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready

    // Trigger publish on first channel
    emit("resource.users", { action: "update", id: "7" });
    const [second] = await readChunks(reader, { count: 1 });
    expect(second).toMatch(/event: message/);
    expect(second).toMatch(
      /data: \{"channel":"resource.users","payload":\{"action":"update","id":"7"\}\}/,
    );

    // And the second channel
    emit("custom", { kind: "other" });
    const [third] = await readChunks(reader, { count: 1 });
    expect(third).toMatch(/event: message/);
    expect(third).toMatch(/data: \{"channel":"custom","payload":\{"kind":"other"\}\}/);
    await reader.cancel();
  });

  it("frames each message as {channel, payload}", async () => {
    const h = stream(makeConfig());
    const req = new Request("http://localhost/stream?channel=resource.users&channel=custom");
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready

    emit("resource.users", { action: "update", id: "1" });
    const [msg] = await readChunks(reader, { count: 1 });
    expect(msg).toBe(
      'event: message\ndata: {"channel":"resource.users","payload":{"action":"update","id":"1"}}\n\n',
    );

    await reader.cancel();
  });

  it("sends a heartbeat comment at the configured interval", async () => {
    vi.useFakeTimers();
    const h = stream(makeConfig());
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
    const h = stream(makeConfig());
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

  it("omits the payload key for undefined events", async () => {
    const h = stream(makeConfig());
    const req = new Request("http://localhost/stream?channel=x");
    const res = await h(req);
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 }); // ready
    emit("x", undefined);
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toMatch(/event: message\ndata: \{"channel":"x"\}\n\n/);
    await reader.cancel();
  });
});

describe("stream() — your own channels", () => {
  beforeEach(() => {
    listeners.clear();
  });

  async function deliveredPayload(config: ResolvedAdminConfig, channel: string): Promise<string> {
    const res = await stream(config)(new Request(`http://localhost/stream?channel=${channel}`));
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 });
    emit(channel, { tenant: "B", jobId: 9 });
    const [msg] = await readChunks(reader, { count: 1 });
    await reader.cancel();
    return msg ?? "";
  }

  it("refuses a channel realtime.channels does not declare", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await stream(makeConfig())(new Request("http://localhost/stream?channel=secret-jobs"));
    expect(listeners.has("secret-jobs")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"secret-jobs"'));
    warn.mockRestore();
  });

  it("refuses a declared channel whose access denies the caller", async () => {
    const config = makeConfig({
      realtime: { driver: "memory", channels: { payouts: { access: "finance" } } },
    });
    const res = await stream(config)(new Request("http://localhost/stream?channel=payouts"));
    expect(listeners.has("payouts")).toBe(false);
    await res.body?.cancel();
  });

  it("sends {} under an admin-wide scope unless the channel is tenant-safe", async () => {
    const scoped = { scope: async () => ({ tenantId: "A" }) } as Partial<ResolvedAdminConfig>;
    const plain = makeConfig({
      ...scoped,
      realtime: { driver: "memory", channels: { jobs: {} } },
    });
    expect(await deliveredPayload(plain, "jobs")).toContain('"payload":{}');
    const safe = makeConfig({
      ...scoped,
      realtime: { driver: "memory", channels: { jobs: { tenantSafe: true } } },
    });
    expect(await deliveredPayload(safe, "jobs")).toContain('"payload":{"tenant":"B","jobId":9}');
  });
});

describe("stream() — limits", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tells a rate-limited reader when to retry", async () => {
    const config = makeConfig({
      auth: { session: async () => ({ id: "limited" }), role: () => "admin" },
      rateLimit: { driver: "memory", limit: 1, windowMs: 30_000 },
    } as Partial<ResolvedAdminConfig>);
    await stream(config)(new Request("http://localhost/stream"));
    const refused = await stream(config)(new Request("http://localhost/stream"));
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("30");
  });

  it("refuses a user's eleventh open stream with 429 and frees a slot on close", async () => {
    const config = makeConfig({
      auth: { session: async () => ({ id: "capped" }), role: () => "admin" },
    } as Partial<ResolvedAdminConfig>);
    const open = await Promise.all(
      Array.from({ length: 10 }, () => stream(config)(new Request("http://localhost/stream"))),
    );
    expect(open.every((res) => res.status === 200)).toBe(true);
    const refused = await stream(config)(new Request("http://localhost/stream"));
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBeNull();
    await open[0]?.body?.cancel();
    const again = await stream(config)(new Request("http://localhost/stream"));
    expect(again.status).toBe(200);
    await Promise.all([again, ...open.slice(1)].map((res) => res.body?.cancel()));
  });

  it("announces, then ends, the stream after maxAgeMs so the browser reconnects through auth", async () => {
    vi.useFakeTimers();
    const res = await stream(makeConfig(), { maxAgeMs: 1000 })(
      new Request("http://localhost/stream"),
    );
    const reader = res.body!.getReader();
    await readChunks(reader, { count: 1 });
    vi.advanceTimersByTime(1000);
    const last = await reader.read();
    expect(new TextDecoder().decode(last.value)).toBe("event: closing\ndata: {}\n\n");
    expect((await reader.read()).done).toBe(true);
  });

  it("refuses a channel whose access rule throws, keeps the stream, and never locks the user out", async () => {
    let flaky = true;
    const onError = vi.fn(async () => {});
    const config = makeConfig({
      auth: { session: async () => ({ id: "flaky" }), role: () => "admin" },
      hooks: { onError },
      realtime: {
        driver: "memory",
        channels: {
          custom: {},
          jobs: {
            access: async () => {
              if (flaky) throw new Error("db blip");
              return true;
            },
          },
        },
      },
    } as Partial<ResolvedAdminConfig>);
    const res = await stream(config)(
      new Request("http://localhost/stream?channel=jobs&channel=custom"),
    );
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const chunks = (await readChunks(reader, { count: 2 })).join("");
    expect(chunks).toContain('event: refused\ndata: {"channels":["jobs"]}');
    expect(listeners.has("custom")).toBe(true);
    expect(listeners.has("jobs")).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    await reader.cancel();

    const streams = await Promise.all(
      Array.from({ length: 10 }, () =>
        stream(config)(new Request("http://localhost/stream?channel=jobs")),
      ),
    );
    await Promise.all(streams.map((opened) => opened.body?.cancel()));
    flaky = false;
    const ok = await stream(config)(new Request("http://localhost/stream?channel=jobs"));
    expect(ok.status).toBe(200);
    await ok.body?.cancel();
  });

  it("frees the slot when the client is gone before the stream starts", async () => {
    const config = makeConfig({
      auth: { session: async () => ({ id: "leaver" }), role: () => "admin" },
    } as Partial<ResolvedAdminConfig>);
    for (let i = 0; i < 11; i++) {
      const gone = new AbortController();
      gone.abort();
      await stream(config)(new Request("http://localhost/stream", { signal: gone.signal }));
    }
    const ok = await stream(config)(new Request("http://localhost/stream"));
    expect(ok.status).toBe(200);
    await ok.body?.cancel();
  });

  it("refuses undeclared names that only Object.prototype knows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await stream(makeConfig())(new Request("http://localhost/stream?channel=constructor"));
    expect(listeners.has("constructor")).toBe(false);
    warn.mockRestore();
  });
});
