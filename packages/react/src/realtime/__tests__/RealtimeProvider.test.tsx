// @vitest-environment happy-dom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

interface InstanceHandle {
  url: string;
  open: () => void;
  message: (d: string) => void;
  error: () => void;
  /** Permanent failure: socket CLOSED, browser will NOT retry. */
  fail: () => void;
  closeSpy: ReturnType<typeof vi.fn>;
}

const instances: InstanceHandle[] = [];

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  onmessage: null | ((e: { data: string }) => void) = null;
  onerror: null | (() => void) = null;
  onopen: null | (() => void) = null;
  readyState: number = MockEventSource.CONNECTING;
  private _closeSpy = vi.fn();
  constructor(public url: string) {
    instances.push({
      url,
      open: () => {
        this.readyState = MockEventSource.OPEN;
        this.onopen?.();
      },
      message: (d) => this.onmessage?.({ data: d }),
      error: () => this.onerror?.(),
      fail: () => {
        this.readyState = MockEventSource.CLOSED;
        this.onerror?.();
      },
      closeSpy: this._closeSpy,
    });
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
    this._closeSpy();
  }
}

import * as React from "react";

import { RealtimeRefresh } from "../../hooks/useRealtimeRefresh.js";
import type { RealtimeStatus } from "../context.js";
import { useRealtimeBus, useRealtimeStatus } from "../hooks.js";
import { RealtimeProvider } from "../RealtimeProvider.js";

/** Direct bus subscriber — lets a test assert per-channel callback routing. */
function Sub({ channels, cb }: { channels: string[]; cb: (data: unknown) => void }) {
  const bus = useRealtimeBus();
  const key = channels.join("|");
  React.useEffect(() => {
    if (!bus) return;
    return bus.subscribe(key.split("|"), cb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, key, cb]);
  return null;
}

const flushReopen = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60);
  });
};

describe("RealtimeProvider", () => {
  beforeEach(() => {
    refresh.mockReset();
    instances.length = 0;
    vi.useFakeTimers();
    (globalThis as never as { EventSource: unknown }).EventSource = MockEventSource;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // The whole reason this provider exists: the prior implementation opened
  // one EventSource per channel per widget, blowing through the browser's
  // 6-connection limit on dashboards with several realtime cards.
  it("opens exactly one EventSource for many widgets sharing channels", async () => {
    render(
      <RealtimeProvider>
        <RealtimeRefresh channels={["a", "b"]} />
        <RealtimeRefresh channels={["a", "b"]} />
        <RealtimeRefresh channels={["a", "b"]} />
        <RealtimeRefresh channels={["b", "c"]} />
      </RealtimeProvider>,
    );
    await flushReopen();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toContain("channel=a");
    expect(instances[0]?.url).toContain("channel=b");
    expect(instances[0]?.url).toContain("channel=c");
  });

  it("debounces reopen across a burst of mounts", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={50}>
        <RealtimeRefresh channels="x" />
        <RealtimeRefresh channels="y" />
        <RealtimeRefresh channels="z" />
      </RealtimeProvider>,
    );
    // Before the debounce fires, no source should exist yet.
    expect(instances).toHaveLength(0);
    await flushReopen();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toMatch(/channel=x.*channel=y.*channel=z/);
  });

  it("coalesces a message into ONE route refresh regardless of widget count", async () => {
    render(
      <RealtimeProvider refreshDebounceMs={10}>
        <RealtimeRefresh channels="a" />
        <RealtimeRefresh channels="b" />
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    expect(instances).toHaveLength(1);
    // First connect must NOT auto-refresh (server-rendered page is fresh).
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
    // One message → provider fires exactly one coalesced refresh for all 3.
    act(() => instances[0]!.message(JSON.stringify({ channel: "a" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes once on reconnect (catch-up after a drop), not on first open", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={10} refreshDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    // First open: no refresh.
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
    // Transient error → browser reconnects → onopen fires again → catch-up.
    act(() => instances[0]!.error());
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does NOT refresh on a channel-set reopen — only a genuine drop catches up", async () => {
    function Host({ extra }: { extra: boolean }) {
      return (
        <RealtimeProvider reopenDebounceMs={10} refreshDebounceMs={10}>
          <RealtimeRefresh channels="a" />
          {extra ? <RealtimeRefresh channels="b" /> : null}
        </RealtimeProvider>
      );
    }
    const { rerender } = render(<Host extra={false} />);
    await flushReopen();
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);

    // Add channel "b" → provider closes the old source and opens a NEW one.
    rerender(<Host extra={true} />);
    await flushReopen();
    expect(instances).toHaveLength(2);
    // First open of the new source must NOT be treated as a catch-up: the
    // navigation/RSC that changed the channel set already rendered fresh data.
    act(() => instances[1]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  it("stays connected while hidden and fires ONE catch-up refresh on return", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={10} refreshDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);

    // Tab goes background.
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    // Events arrive while hidden: no refresh, and the socket stays OPEN
    // (the whole point — no reconnect on tab switch).
    act(() => instances[0]!.message(JSON.stringify({ channel: "a" })));
    act(() => instances[0]!.message(JSON.stringify({ channel: "a" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.closeSpy).toHaveBeenCalledTimes(0);

    // Tab returns → exactly one coalesced catch-up refresh.
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on return when nothing arrived while hidden", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={10} refreshDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  it("defers the reconnect catch-up while hidden, then catches up once on return", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={10} refreshDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);

    // Tab hidden.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    // Transient drop + browser auto-reconnect WHILE hidden: onopen fires AGAIN
    // on the same source. It must NOT refresh a backgrounded tab.
    act(() => instances[0]!.error());
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);

    // Return → exactly one coalesced catch-up.
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("surfaces 'reconnecting' for both a transient error and a permanently CLOSED socket (the bus retries either way)", async () => {
    let status: RealtimeStatus = "idle";
    function Probe() {
      status = useRealtimeStatus();
      return null;
    }
    render(
      <RealtimeProvider reopenDebounceMs={10}>
        <Probe />
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    expect(status).toBe("live");
    // A transient error keeps the socket retrying → reconnecting.
    act(() => instances[0]!.error());
    expect(status).toBe("reconnecting");
    act(() => instances[0]!.open());
    expect(status).toBe("live");
    // A CLOSED socket means the browser stopped retrying, but the bus now
    // schedules its own reconnect (Task 1.3) — still surfaced as
    // "reconnecting", not the terminal "offline".
    act(() => instances[0]!.fail());
    expect(status).toBe("reconnecting");
  });

  it("reconnects with exponential backoff after the socket is permanently CLOSED", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    act(() => instances[0]!.fail());
    expect(instances).toHaveLength(1);
    // First backoff: 500ms * 2^0 = 500ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(instances).toHaveLength(2);
  });

  it("resets the reconnect attempt counter once the new connection opens", async () => {
    render(
      <RealtimeProvider reopenDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    act(() => instances[0]!.fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(instances).toHaveLength(2);
    // New source opens successfully → attempt resets to 0, so the next
    // failure backs off at the base delay again, not a doubled one.
    act(() => instances[1]!.open());
    act(() => instances[1]!.fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(instances).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(instances).toHaveLength(3);
  });

  it("ignores a stale EventSource's onerror after it has been superseded by a newer source", async () => {
    let status: RealtimeStatus = "idle";
    function Probe() {
      status = useRealtimeStatus();
      return null;
    }
    function Host({ extra }: { extra: boolean }) {
      return (
        <RealtimeProvider reopenDebounceMs={10}>
          <Probe />
          <RealtimeRefresh channels="a" />
          {extra ? <RealtimeRefresh channels="b" /> : null}
        </RealtimeProvider>
      );
    }
    const { rerender } = render(<Host extra={false} />);
    await flushReopen();
    const sourceA = instances[0]!;
    act(() => sourceA.open());
    expect(status).toBe("live");

    // Channel-set change → provider closes A (readyState → CLOSED) and opens B.
    rerender(<Host extra={true} />);
    await flushReopen();
    expect(instances).toHaveLength(2);
    const sourceB = instances[1]!;
    act(() => sourceB.open());
    expect(status).toBe("live");

    // A's trailing onerror arrives after it was already superseded — must be
    // a full no-op: no status flip, no attempt bump, no reconnect scheduled.
    act(() => sourceA.error());
    expect(status).toBe("live");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(instances).toHaveLength(2);
    expect(status).toBe("live");
  });

  it("clears the pending reconnect timer on unmount", async () => {
    const { unmount } = render(
      <RealtimeProvider reopenDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    act(() => instances[0]!.fail());
    unmount();
    // No pending reconnect fires after unmount — nothing left to assert on
    // (openSource closures over a null stateRef.current no-op), but this
    // must not throw and must not open a new EventSource.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(instances).toHaveLength(1);
  });

  it("routes an envelope to only its own channel's subscriber", async () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    render(
      <RealtimeProvider refreshDebounceMs={10}>
        <Sub channels={["a"]} cb={cbA} />
        <Sub channels={["b"]} cb={cbB} />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    act(() => {
      instances[0]!.message(JSON.stringify({ channel: "b", payload: { x: 1 } }));
    });
    expect(cbB).toHaveBeenCalledWith({ x: 1 });
    expect(cbA).not.toHaveBeenCalled();
  });

  it("invokes a callback subscribed to two channels exactly once for a single-channel message", async () => {
    const cb = vi.fn();
    render(
      <RealtimeProvider refreshDebounceMs={10}>
        <Sub channels={["a", "b"]} cb={cb} />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    act(() => {
      instances[0]!.message(JSON.stringify({ channel: "a", payload: 1 }));
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it("schedules a coalesced refresh for a well-formed envelope even with no local subscriber", async () => {
    render(
      <RealtimeProvider refreshDebounceMs={10}>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
    act(() => {
      instances[0]!.message(JSON.stringify({ channel: "z" }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("drops a malformed frame silently: no dispatch, no refresh", async () => {
    const cb = vi.fn();
    render(
      <RealtimeProvider refreshDebounceMs={10}>
        <Sub channels={["a"]} cb={cb} />
      </RealtimeProvider>,
    );
    await flushReopen();
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(0);
    act(() => instances[0]!.message("not json"));
    act(() => instances[0]!.message(JSON.stringify({ noChannel: true })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(cb).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  it("closes the source when the last subscriber unmounts", async () => {
    const { unmount } = render(
      <RealtimeProvider>
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    await flushReopen();
    expect(instances).toHaveLength(1);
    const closeSpy = instances[0]!.closeSpy;
    unmount();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("reopens with a new channel set when a subscriber unmounts mid-life", async () => {
    function Host({ extra }: { extra: boolean }) {
      return (
        <RealtimeProvider reopenDebounceMs={10}>
          <RealtimeRefresh channels="a" />
          {extra ? <RealtimeRefresh channels="b" /> : null}
        </RealtimeProvider>
      );
    }
    const { rerender } = render(<Host extra={true} />);
    await flushReopen();
    expect(instances).toHaveLength(1);
    const first = instances[0]!;
    expect(first.url).toContain("channel=a");
    expect(first.url).toContain("channel=b");

    rerender(<Host extra={false} />);
    await flushReopen();
    // Source was closed and reopened with the smaller set.
    expect(first.closeSpy).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(2);
    expect(instances[1]!.url).toContain("channel=a");
    expect(instances[1]!.url).not.toContain("channel=b");
  });

  it("falls back to legacy per-channel EventSource when no provider is mounted", () => {
    render(<RealtimeRefresh channels={["a", "b"]} />);
    // Legacy path is synchronous (no provider debounce).
    expect(instances).toHaveLength(2);
  });

  // Status hook drives the `<LiveIndicator>`. We track the value through a
  // probe component so the test reads what the UI would see.
  it("useRealtimeStatus transitions idle → connecting → live → reconnecting", async () => {
    const seen: RealtimeStatus[] = [];
    function Probe() {
      const s = useRealtimeStatus();
      seen.push(s);
      return null;
    }
    render(
      <RealtimeProvider reopenDebounceMs={10}>
        <Probe />
        <RealtimeRefresh channels="a" />
      </RealtimeProvider>,
    );
    // Initial mount before reopen tick — status is idle.
    expect(seen[0]).toBe("idle");

    await flushReopen();
    // After reopen → connecting (open hasn't fired yet on mock).
    expect(seen).toContain("connecting");

    // Trigger open event — should flip to live.
    act(() => instances[0]!.open());
    expect(seen[seen.length - 1]).toBe("live");

    // Simulate transient error → reconnecting.
    act(() => instances[0]!.error());
    expect(seen[seen.length - 1]).toBe("reconnecting");
  });

  it("useRealtimeStatus returns 'idle' when no provider is mounted", () => {
    let last: RealtimeStatus = "live";
    function Probe() {
      last = useRealtimeStatus();
      return null;
    }
    render(<Probe />);
    expect(last).toBe("idle");
  });
});
