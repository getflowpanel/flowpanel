import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveChannel } from "../useLiveChannel.js";

const instances: MockEventSource[] = [];

class MockEventSource {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSED = 2 as const;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onopen: ((ev: Event) => void) | null = null;
  readyState: number = MockEventSource.CONNECTING;
  constructor(public url: string) {
    instances.push(this);
  }
  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.({} as Event);
  }
  message(data: string): void {
    this.onmessage?.({ data });
  }
  error(): void {
    this.onerror?.({} as Event);
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }
}

let Harness: React.FC<{ channel: string; onMessage: (p: unknown) => void }>;

describe("useLiveChannel", () => {
  beforeEach(() => {
    instances.length = 0;
    vi.useFakeTimers();
    (globalThis as never as { EventSource: unknown }).EventSource = MockEventSource;
    Harness = ({ channel, onMessage }) => {
      const status = useLiveChannel(channel, onMessage);
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

  it("invokes onMessage with JSON-parsed payload", () => {
    const handler = vi.fn();
    render(<Harness channel="x" onMessage={handler} />);
    act(() => {
      instances[0]!.open();
    });
    act(() => {
      instances[0]!.message(JSON.stringify({ hi: 1 }));
    });
    expect(handler).toHaveBeenCalledWith({ hi: 1 });
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

  it("treats empty data as undefined payload", () => {
    const handler = vi.fn();
    render(<Harness channel="x" onMessage={handler} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.message(""));
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it("reconnects with exponential backoff on error", async () => {
    const { getByTestId } = render(<Harness channel="x" onMessage={() => undefined} />);
    act(() => instances[0]!.open());
    act(() => instances[0]!.error());
    expect(getByTestId("status").textContent).toBe("reconnecting");
    // First backoff: 500ms * 2^1 = 1000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(instances).toHaveLength(2);
  });

  it("is idle when channel is empty", () => {
    const { getByTestId } = render(<Harness channel="" onMessage={() => undefined} />);
    expect(instances).toHaveLength(0);
    expect(getByTestId("status").textContent).toBe("idle");
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
        instances[0]!.message(JSON.stringify({ hi: 1 }));
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
      const handlerA = vi.fn(() => {
        throw new Error("boom");
      });
      const handlerB = vi.fn();
      render(<Pooled showA showB onA={handlerA} onB={handlerB} />);
      act(() => instances[0]!.open());
      act(() => {
        instances[0]!.message(JSON.stringify({ hi: 1 }));
      });
      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledWith({ hi: 1 });
    });
  });
});
