import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  fail: () => void;
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
      close: () => {
        this.readyState = MockEventSource.CLOSED;
      },
      onopen: this.onopen,
      onmessage: this.onmessage,
      onerror: this.onerror,
    });
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }
}

import { RealtimeProvider } from "../../realtime/RealtimeProvider.js";
import { DataTable } from "../DataTable.js";

const COLUMNS = [{ field: "name" as const }];
const ROWS = [{ id: "1", name: "a" }];

function Table({ debounceMs }: { debounceMs?: number }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={ROWS}
      rowKey="id"
      total={1}
      page={1}
      pageSize={10}
      realtime={
        debounceMs === undefined
          ? "resource.users"
          : { channel: "resource.users", debounceMs: debounceMs }
      }
    />
  );
}

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

  it("surfaces the connection status", () => {
    const { getByRole } = render(<Table />);
    expect(getByRole("status").getAttribute("aria-label")).toBe("Connecting…");
    act(() => instances[0]!.open());
    expect(getByRole("status").getAttribute("aria-label")).toBe("Live");
    act(() => instances[0]!.fail());
    expect(getByRole("status").getAttribute("aria-label")).toBe("Reconnecting…");
  });

  describe("under a RealtimeProvider", () => {
    const flushReopen = async () => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });
    };

    it("joins the bus instead of opening a second EventSource", async () => {
      render(
        <RealtimeProvider>
          <Table />
        </RealtimeProvider>,
      );
      await flushReopen();
      expect(instances).toHaveLength(1);
      expect(instances[0]?.url).toContain("channel=resource.users");
    });

    it("refreshes once per event — the provider owns the refresh", async () => {
      render(
        <RealtimeProvider>
          <Table debounceMs={100} />
        </RealtimeProvider>,
      );
      await flushReopen();
      act(() => instances[0]!.open());
      act(() =>
        instances[0]!.message(JSON.stringify({ channel: "resource.users", payload: { id: "1" } })),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("shows the bus status", async () => {
      const { getByRole } = render(
        <RealtimeProvider>
          <Table />
        </RealtimeProvider>,
      );
      await flushReopen();
      act(() => instances[0]!.open());
      expect(getByRole("status").getAttribute("aria-label")).toBe("Live");
    });
  });
});
