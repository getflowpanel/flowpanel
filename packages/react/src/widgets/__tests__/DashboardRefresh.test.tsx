// @vitest-environment happy-dom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin",
}));

import { DashboardRefresh } from "../DashboardRefresh";

function hide(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
}

describe("DashboardRefresh", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.useFakeTimers();
    hide(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("re-renders the dashboard once per interval", () => {
    render(<DashboardRefresh intervalMs={60_000} renderedAt={Date.now()} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(120_000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("skips the refresh while the tab is hidden and resumes when it comes back", () => {
    render(<DashboardRefresh intervalMs={60_000} renderedAt={Date.now()} />);
    hide(true);
    act(() => vi.advanceTimersByTime(180_000));
    expect(refresh).not.toHaveBeenCalled();

    hide(false);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stamps the numbers as fresh on first paint", () => {
    render(<DashboardRefresh intervalMs={60_000} renderedAt={Date.now()} />);
    expect(screen.getByText("Updated just now")).toBeTruthy();
  });

  it("ages the stamp through seconds and then minutes", () => {
    render(<DashboardRefresh intervalMs={600_000} renderedAt={Date.now()} />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("Updated 30s ago")).toBeTruthy();
    act(() => vi.advanceTimersByTime(90_000));
    expect(screen.getByText("Updated 2m ago")).toBeTruthy();
  });
});
