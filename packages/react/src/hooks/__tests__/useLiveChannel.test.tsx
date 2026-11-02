import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeProvider } from "../../realtime/RealtimeProvider";
import { useLiveChannel } from "../useLiveChannel";
import { RealtimeRefresh } from "../useRealtimeRefresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const instances: MockEventSource[] = [];

class MockEventSource {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSED = 2 as const;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onopen: ((ev: Event) => void) | null = null;
  readyState: number = MockEventSource.CONNECTING;
  /** The server\'s named events, such as the `ready` frame it sends once the stream answers. */
  listeners = new Map<string, Array<() => void>>();
  addEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  constructor(public url: string) {
    instances.push(this);
  }
  /** The stream answers: the connection opens and the server sends its `ready` frame. */
  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.({} as Event);
    for (const fn of this.listeners.get("ready") ?? []) fn();
  }
  /** A named server event, such as `closing` before a planned end. */
  emit(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
  /** The connection opens but no frame follows yet. */
  connect(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.({} as Event);
  }
  message(data: string): void {
    this.onmessage?.({ data });
  }
  /** Transient error — the browser keeps retrying on its own (socket not CLOSED). */
  error(): void {
    this.onerror?.({} as Event);
  }
  /** Permanent failure — socket CLOSED, the browser will not retry. */
  fail(): void {
    this.readyState = MockEventSource.CLOSED;
    this.onerror?.({} as Event);
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }
}

let Harness: React.FC<{ channel: string; onMessage: (p: unknown) => void; enabled?: boolean }>;

describe("useLiveChannel", () => {
  beforeEach(() => {
    instances.length = 0;
    vi.useFakeTimers();
    (globalThis as never as { EventSource: unknown }).EventSource = MockEventSource;
    Harness = ({ channel, onMessage, enabled }) => {
      const status = useLiveChannel(channel, onMessage, enabled === undefined ? {} : { enabled });
      return <div data-testid="status">{status}</div>;
    };
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens EventSource with encoded channel query param", () => {
    render(<Harness channel="resource.users" onMessage={() => undefined} />);
    expect(instances[0]?.url).toBe("/api/flowpanel/stream?channel=resource.users");
  });

  it("reports 'live' after onopen", () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => {
      instances[0]!.open();
    });
    expect(getByTestId("status").textContent).toBe("live");
  });

  it("unwraps a channel envelope and delivers only the payload", () => {
    const handler = vi.fn();
    render(<Harness channel="x" onMessage={handler} />);
    act(() => instances[0]!.open());
    act(() => {
      instances[0]!.message(JSON.stringify({ channel: "x", payload: { hi: 1 } }));
    });
    expect(handler).toHaveBeenCalledWith({ hi: 1 });
    expect(handler).not.toHaveBeenCalledWith({ channel: "x", payload: { hi: 1 } });
  });

  it("delivers an envelope carrying no payload", () => {
    const handler = vi.fn();
    render(<Harness channel="x" onMessage={handler} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.message(JSON.stringify({ channel: "x" })));
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it("drops a frame addressed to another channel", () => {
    const handler = vi.fn();
    render(<Harness channel="x" onMessage={handler} />);
    act(() => instances[0]!.open());
    act(() => {
      instances[0]!.message(JSON.stringify({ channel: "other", payload: { hi: 1 } }));
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("drops frames that are not channel envelopes", () => {
    const handler = vi.fn();
    render(<Harness channel="x" onMessage={handler} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.message(JSON.stringify({ hi: 1 })));
    act(() => instances[0]!.message(""));
    act(() => instances[0]!.message("not json"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("reconnects with exponential backoff once the socket is CLOSED", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.fail());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    // Shared schedule (realtime/backoff.ts): first retry at 500ms, not 1000ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(instances).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(instances).toHaveLength(2);
  });

  it("leaves a transient error to the browser instead of escalating the backoff", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.error());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // The socket is still OPEN — the browser owns this retry, we must not open a second one.
    expect(instances).toHaveLength(1);
    act(() => instances[0]!.open());
    expect(getByTestId("status").textContent).toBe("live");
  });

  it("ignores a superseded source's error and keeps the live one open", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    const stale = instances[0]!;
    act(() => stale.open());
    act(() => stale.fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(instances).toHaveLength(2);
    const current = instances[1]!;
    act(() => current.open());
    expect(getByTestId("status").textContent).toBe("live");

    act(() => stale.fail());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(current.readyState).not.toBe(MockEventSource.CLOSED);
    expect(getByTestId("status").textContent).toBe("live");
    expect(instances).toHaveLength(2);
  });

  it("does not double-connect when two errors arrive before the reconnect timer fires", async () => {
    render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => {
      instances[0]!.fail();
      instances[0]!.fail();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(instances).toHaveLength(2);
  });

  it("reports offline once failures have lasted 30 seconds, and keeps retrying", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.fail());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(getByTestId("status").textContent).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(getByTestId("status").textContent).toBe("offline");
    const opened = instances.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(instances.length).toBeGreaterThan(opened - 1);
    act(() => instances[instances.length - 1]!.open());
    expect(getByTestId("status").textContent).toBe("live");
  });

  it("promotes a reconnecting entry back to 'live' on a message from a fresh reconnect, resetting attempt", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.fail());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    // attempt is now 1 (one hard failure). Let the scheduled reconnect open a
    // second EventSource without opening it — the entry stays "reconnecting".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(instances).toHaveLength(2);
    expect(getByTestId("status").textContent).toBe("reconnecting");

    // A message arrives before onopen ever fires on this source.
    act(() => {
      instances[1]!.message(JSON.stringify({ hi: 1 }));
    });
    expect(getByTestId("status").textContent).toBe("live");

    // Discriminates the fix: with attempt reset to 0 by the message above,
    // the next failure schedules backoffDelay(0) = 500ms, so a third source
    // exists once 500ms elapse. Without the reset, attempt is still 1 and
    // backoffDelay(1) = 1000ms, so nothing would have opened by t=500ms.
    act(() => instances[1]!.fail());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(instances).toHaveLength(3);
  });

  it("reports idle, not offline, when the subscription is torn down", () => {
    const { getByTestId, rerender } = render(
      <Harness channel="x" onMessage={() => undefined} enabled />,
    );
    act(() => instances[0]!.open());
    expect(getByTestId("status").textContent).toBe("live");
    rerender(<Harness channel="x" onMessage={() => undefined} enabled={false} />);
    expect(getByTestId("status").textContent).toBe("idle");
  });

  it("is idle when channel is empty", () => {
    const { getByTestId } = render(<Harness channel="" onMessage={() => undefined} />);
    expect(instances).toHaveLength(0);
    expect(getByTestId("status").textContent).toBe("idle");
  });

  it("reads 'reconnecting' from the moment the server closes the stream until a frame arrives", () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    expect(getByTestId("status").textContent).toBe("live");
    // The server ends the response: the browser reports an error and reconnects on its own.
    act(() => instances[0]!.error());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    // The socket opens again, but an open connection proves nothing until the server speaks.
    act(() => instances[0]!.connect());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    act(() => instances[0]!.message(JSON.stringify({ channel: "x", payload: 1 })));
    expect(getByTestId("status").textContent).toBe("live");
  });

  it("stays live through a stream the server ends on purpose and reconnects at once", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.emit("closing"));
    act(() => instances[0]!.error());
    expect(getByTestId("status").textContent).toBe("live");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    act(() => instances[0]!.open());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getByTestId("status").textContent).toBe("live");
  });

  it("admits a planned reconnect that does not come back in time", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.emit("closing"));
    act(() => instances[0]!.error());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(getByTestId("status").textContent).toBe("reconnecting");
  });

  it("goes offline while the browser's own one-second retries keep failing for 30 seconds", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    for (let second = 0; second < 29; second += 1) {
      act(() => instances[0]!.error());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(getByTestId("status").textContent).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(getByTestId("status").textContent).toBe("offline");
    expect(instances).toHaveLength(1);
  });

  it("joins the admin's provider instead of opening a second stream, without refreshing the route", async () => {
    const onMessage = vi.fn();
    render(
      <RealtimeProvider>
        <RealtimeRefresh channels="resource.orders" />
        <Harness channel="ops" onMessage={onMessage} />
      </RealtimeProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toContain("channel=ops");
    expect(instances[0]?.url).toContain("channel=resource.orders");
    act(() => instances[0]!.open());
    act(() => instances[0]!.message(JSON.stringify({ channel: "ops", payload: { n: 1 } })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onMessage).toHaveBeenCalledWith({ n: 1 });
    expect(refresh).not.toHaveBeenCalled();
  });

  describe("connection pooling", () => {
    let SubA: React.FC<{ onMessage: (p: unknown) => void }>;
    let SubB: React.FC<{ onMessage: (p: unknown) => void }>;
    let Pooled: React.FC<{
      showA: boolean;
      showB: boolean;
      onA: (p: unknown) => void;
      onB: (p: unknown) => void;
    }>;

    beforeEach(() => {
      SubA = ({ onMessage }) => {
        const status = useLiveChannel("shared", onMessage);
        return <div data-testid="status-a">{status}</div>;
      };
      SubB = ({ onMessage }) => {
        const status = useLiveChannel("shared", onMessage);
        return <div data-testid="status-b">{status}</div>;
      };
      Pooled = ({ showA, showB, onA, onB }) => (
        <>
          {showA && <SubA onMessage={onA} />}
          {showB && <SubB onMessage={onB} />}
        </>
      );
    });

    it("shares a single EventSource across two hook instances on the same channel", () => {
      render(<Pooled showA showB onA={() => undefined} onB={() => undefined} />);
      expect(instances).toHaveLength(1);
    });

    it("keeps the shared source open when only one of two subscribers unmounts", () => {
      const { rerender } = render(
        <Pooled showA showB onA={() => undefined} onB={() => undefined} />,
      );
      expect(instances).toHaveLength(1);
      rerender(<Pooled showA showB={false} onA={() => undefined} onB={() => undefined} />);
      expect(instances[0]!.readyState).not.toBe(MockEventSource.CLOSED);
    });

    it("closes the shared source once the last subscriber unmounts", () => {
      const { rerender } = render(
        <Pooled showA showB onA={() => undefined} onB={() => undefined} />,
      );
      rerender(<Pooled showA={false} showB={false} onA={() => undefined} onB={() => undefined} />);
      expect(instances[0]!.readyState).toBe(MockEventSource.CLOSED);
    });

    it("delivers each message once to every subscriber's own callback", () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();
      render(<Pooled showA showB onA={handlerA} onB={handlerB} />);
      act(() => instances[0]!.open());
      act(() => {
        instances[0]!.message(JSON.stringify({ channel: "shared", payload: { hi: 1 } }));
      });
      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerA).toHaveBeenCalledWith({ hi: 1 });
      expect(handlerB).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledWith({ hi: 1 });
    });

    it("shows a hook joining an already-live entry as 'live' immediately, not 'idle'", () => {
      const { getByTestId, rerender } = render(
        <Pooled showA showB={false} onA={() => undefined} onB={() => undefined} />,
      );
      act(() => instances[0]!.open());
      expect(getByTestId("status-a").textContent).toBe("live");
      rerender(<Pooled showA showB onA={() => undefined} onB={() => undefined} />);
      expect(getByTestId("status-b").textContent).toBe("live");
      expect(instances).toHaveLength(1);
    });

    it("isolates one listener's throw so the other still gets the payload exactly once", () => {
      const boom = new Error("boom");
      const report = vi.fn();
      vi.stubGlobal("reportError", report);
      const handlerA = vi.fn(() => {
        throw boom;
      });
      const handlerB = vi.fn();
      render(<Pooled showA showB onA={handlerA} onB={handlerB} />);
      act(() => instances[0]!.open());
      act(() => {
        instances[0]!.message(JSON.stringify({ channel: "shared", payload: { hi: 1 } }));
      });
      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledWith({ hi: 1 });
      expect(report).toHaveBeenCalledWith(boom);
      vi.unstubAllGlobals();
    });
  });
});
