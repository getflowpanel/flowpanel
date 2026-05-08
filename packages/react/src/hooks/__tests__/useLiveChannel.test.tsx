import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
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
});
