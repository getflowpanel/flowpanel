// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/orders",
}));

const instances: Array<{ url: string }> = [];
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  onmessage: null | ((e: { data: string }) => void) = null;
  onerror: null | (() => void) = null;
  onopen: null | (() => void) = null;
  readyState: number = MockEventSource.CONNECTING;
  constructor(public url: string) {
    instances.push({ url });
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }
}

import { TableWidget } from "../TableWidget";

describe("TableWidget realtime", () => {
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

  it("subscribes when realtime is a string", () => {
    render(
      <TableWidget
        rows={[{ id: "1", name: "a" }]}
        columns={[{ field: "name" }]}
        rowKey="id"
        realtime="resource.orders"
      />,
    );
    // DataTable also receives realtime via its own prop (it does not here),
    // but the widget renders a RealtimeRefresh subscriber for its option.
    expect(instances.some((i) => i.url.includes("channel=resource.orders"))).toBe(true);
  });

  it("subscribes to each channel when realtime is an array", () => {
    render(
      <TableWidget
        rows={[{ id: "1", name: "a" }]}
        columns={[{ field: "name" }]}
        rowKey="id"
        realtime={["resource.a", "resource.b"]}
      />,
    );
    const urls = instances.map((i) => i.url);
    expect(urls.some((u) => u.includes("channel=resource.a"))).toBe(true);
    expect(urls.some((u) => u.includes("channel=resource.b"))).toBe(true);
  });

  it("does not subscribe when realtime is absent", () => {
    render(
      <TableWidget rows={[{ id: "1", name: "a" }]} columns={[{ field: "name" }]} rowKey="id" />,
    );
    expect(instances).toHaveLength(0);
  });

  it("renders an embedded table inside one framed surface", () => {
    render(
      <TableWidget
        label="Recent orders"
        rows={[{ id: "1", name: "a" }]}
        columns={[{ field: "name" }]}
        rowKey="id"
      />,
    );

    const framedAncestors: HTMLElement[] = [];
    let node = screen.getByRole("table").parentElement;
    while (node) {
      if (node.classList.contains("border") && node.classList.contains("border-fp-border-1")) {
        framedAncestors.push(node);
      }
      node = node.parentElement;
    }

    expect(framedAncestors).toHaveLength(1);
  });

  it("fills its dashboard grid slot so neighboring cards align", () => {
    render(
      <TableWidget
        label="Recent orders"
        rows={[{ id: "1", name: "a" }]}
        columns={[{ field: "name" }]}
        rowKey="id"
      />,
    );

    expect(screen.getByRole("table").closest(".h-full")).not.toBeNull();
  });
});
