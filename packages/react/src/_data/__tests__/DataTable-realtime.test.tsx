import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, cleanup } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/users",
}));

const instances: Array<{
  url: string;
  open: () => void;
  message: (d: string) => void;
  error: () => void;
  close: () => void;
  onopen: null | (() => void);
  onmessage: null | ((e: { data: string }) => void);
  onerror: null | (() => void);
}> = [];

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  onmessage: null | ((e: { data: string }) => void) = null;
  onerror: null | (() => void) = null;
  onopen: null | (() => void) = null;
  readyState: number = MockEventSource.CONNECTING;
  constructor(public url: string) {
    const self = this;
    instances.push({
      url,
      open: () => {
        self.readyState = MockEventSource.OPEN;
        self.onopen?.();
      },
      message: (d) => self.onmessage?.({ data: d }),
      error: () => self.onerror?.(),
      close: () => {
        self.readyState = MockEventSource.CLOSED;
      },
      onopen: self.onopen,
      onmessage: self.onmessage,
      onerror: self.onerror,
    });
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }
}

import { DataTable } from "../DataTable.js";

describe("DataTable realtime", () => {
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

  it("subscribes to the channel prop", () => {
    render(
      <DataTable
        columns={[{ field: "name" }]}
        rows={[{ id: "1", name: "a" }]}
        rowKey="id"
        total={1}
        page={1}
        pageSize={10}
        realtime="resource.users"
      />,
    );
    expect(instances[0]?.url).toContain("channel=resource.users");
  });

  it("debounces router.refresh on message", async () => {
    render(
      <DataTable
        columns={[{ field: "name" }]}
        rows={[{ id: "1", name: "a" }]}
        rowKey="id"
        total={1}
        page={1}
        pageSize={10}
        realtime={{ channel: "resource.users", debounceMs: 100 }}
      />,
    );
    // Open via mock handler registered on the instance
    act(() => {
      // access the DOM mock's open() through the instances array we pushed into
      (instances[0]! as unknown as { open: () => void }).open();
    });
    // Message triggers debounce
    act(() => {
      (instances[0]! as unknown as { message: (d: string) => void }).message("{}");
    });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when realtime is absent", () => {
    render(
      <DataTable
        columns={[{ field: "name" }]}
        rows={[]}
        rowKey="id"
        total={0}
        page={1}
        pageSize={10}
      />,
    );
    expect(instances).toHaveLength(0);
  });
});
