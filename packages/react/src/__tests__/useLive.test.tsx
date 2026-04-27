/**
 * @vitest-environment jsdom
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLive } from "../hooks/useLive";

interface FakeEventSource {
  url: string;
  onopen?: () => void;
  onerror?: () => void;
  listeners: Map<string, (e: MessageEvent) => void>;
  close: () => void;
}

let lastES: FakeEventSource | null = null;

class MockEventSource {
  url: string;
  onopen: (() => void) | undefined;
  onerror: (() => void) | undefined;
  listeners = new Map<string, (e: MessageEvent) => void>();
  constructor(url: string) {
    this.url = url;
    lastES = this;
  }
  addEventListener(name: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(name, fn);
  }
  close() {}
}

describe("useLive", () => {
  beforeEach(() => {
    lastES = null;
    // biome-ignore lint/suspicious/noExplicitAny: patching global for the test
    (globalThis as any).EventSource = MockEventSource;
  });
  afterEach(() => {
    // biome-ignore lint/suspicious/noExplicitAny: patching global for the test
    (globalThis as any).EventSource = undefined;
  });

  it("fires onEvent when the configured channel receives a message", () => {
    const onEvent = vi.fn();
    function TestComponent() {
      useLive({ channel: "resource.user", onEvent });
      return null;
    }
    render(<TestComponent />);
    expect(lastES).not.toBeNull();

    act(() => {
      lastES?.onopen?.();
    });
    act(() => {
      const listener = lastES?.listeners.get("resource.user");
      listener?.({
        data: JSON.stringify({ op: "update", id: 7 }),
        lastEventId: "e-42",
      } as unknown as MessageEvent);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0]?.[0]).toEqual({
      id: "e-42",
      channel: "resource.user",
      data: { op: "update", id: 7 },
    });
  });

  it("ignores events on other channels", () => {
    const onEvent = vi.fn();
    function TestComponent() {
      useLive({ channel: "resource.user", onEvent });
      return null;
    }
    render(<TestComponent />);
    act(() => {
      const listener = lastES?.listeners.get("resource.payment");
      listener?.({
        data: JSON.stringify({ op: "create", id: 1 }),
        lastEventId: "e-9",
      } as unknown as MessageEvent);
    });
    expect(onEvent).not.toHaveBeenCalled();
  });
});
