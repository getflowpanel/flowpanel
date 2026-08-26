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
      closeSpy: this._closeSpy,
    });
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
    this._closeSpy();
  }
}

import { RealtimeRefresh } from "../useRealtimeRefresh";

describe("useRealtimeRefresh / RealtimeRefresh", () => {
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

  it("subscribes to a single string channel", () => {
    render(<RealtimeRefresh channels="resource.orders" />);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toContain("channel=resource.orders");
  });

  it("multiplexes every channel in an array onto one EventSource", () => {
    render(<RealtimeRefresh channels={["resource.a", "resource.b"]} />);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toContain("channel=resource.a");
    expect(instances[0]?.url).toContain("channel=resource.b");
  });

  it("shares one EventSource across two components subscribing to the same channels", () => {
    render(
      <>
        <RealtimeRefresh channels={["resource.a", "resource.b"]} />
        <RealtimeRefresh channels={["resource.b", "resource.a"]} />
      </>,
    );
    expect(instances).toHaveLength(1);
  });

  it("does not subscribe when channels is undefined", () => {
    render(<RealtimeRefresh channels={undefined} />);
    expect(instances).toHaveLength(0);
  });

  it("debounces router.refresh on message (default 200ms)", async () => {
    render(<RealtimeRefresh channels="resource.x" />);
    act(() => instances[0]!.message(JSON.stringify({ channel: "resource.x" })));
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(220);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("honors custom debounceMs", async () => {
    render(<RealtimeRefresh channels="resource.x" debounceMs={50} />);
    act(() => instances[0]!.message(JSON.stringify({ channel: "resource.x" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple events into a single refresh within the window", async () => {
    render(<RealtimeRefresh channels="resource.x" debounceMs={50} />);
    act(() => {
      instances[0]!.message(JSON.stringify({ channel: "resource.x" }));
      instances[0]!.message(JSON.stringify({ channel: "resource.x" }));
      instances[0]!.message(JSON.stringify({ channel: "resource.x" }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refresh fires once per event on the multiplexed source", async () => {
    render(<RealtimeRefresh channels={["resource.a", "resource.b"]} debounceMs={50} />);
    act(() => instances[0]!.message(JSON.stringify({ channel: "resource.a" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    act(() => instances[0]!.message(JSON.stringify({ channel: "resource.b" })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = render(<RealtimeRefresh channels={["a", "b"]} />);
    expect(instances).toHaveLength(1);
    const closeSpy = instances[0]!.closeSpy;
    unmount();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("dedupes duplicate channels — one channel param per unique name", () => {
    render(<RealtimeRefresh channels={["dup", "dup", "other", "dup"]} />);
    expect(instances).toHaveLength(1);
    const url = instances[0]!.url;
    expect(url.match(/channel=dup/g)).toHaveLength(1);
    expect(url).toContain("channel=other");
  });

  it("does not churn subscriptions when parent re-renders with a new array literal", () => {
    function Host({ tick }: { tick: number }) {
      // A new array literal each render with the same contents — must not
      // cause us to tear down and reopen EventSources.
      return (
        <>
          <div data-testid="tick">{tick}</div>
          <RealtimeRefresh channels={["x", "y"]} />
        </>
      );
    }
    const { rerender } = render(<Host tick={0} />);
    expect(instances).toHaveLength(1);
    const closeSpy = instances[0]!.closeSpy;
    rerender(<Host tick={1} />);
    rerender(<Host tick={2} />);
    // No new instances and no closes.
    expect(instances).toHaveLength(1);
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
