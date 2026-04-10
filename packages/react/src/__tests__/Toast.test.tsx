import { cleanup, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ToastProvider, useToast } from "../components/Toast.js";

function ToastTrigger({ messages }: { messages?: string[] }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => {
        for (const msg of messages ?? ["Hello"]) {
          toast(msg);
        }
      }}
    >
      trigger
    </button>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("shows toast and auto-dismisses", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("trigger").click();
    });

    expect(screen.getByText("Hello")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  it("limits visible toasts to 3", () => {
    render(
      <ToastProvider>
        <ToastTrigger messages={["A", "B", "C", "D"]} />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("trigger").click();
    });

    // Only last 3 should be visible (B, C, D)
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });
});
