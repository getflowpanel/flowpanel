import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDrawerURL } from "../hooks/useDrawerURL.js";

describe("useDrawerURL", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin");
  });

  it("reads ?run= from URL on mount", () => {
    window.history.replaceState({}, "", "/admin?run=abc123");
    const { result } = renderHook(() => useDrawerURL());
    expect(result.current.runId).toBe("abc123");
  });

  it("returns null when no ?run= param", () => {
    const { result } = renderHook(() => useDrawerURL());
    expect(result.current.runId).toBeNull();
  });

  it("open() updates runId state", () => {
    const { result } = renderHook(() => useDrawerURL());
    act(() => result.current.open("xyz789"));
    expect(result.current.runId).toBe("xyz789");
  });

  it("close() clears runId state", () => {
    window.history.replaceState({}, "", "/admin?run=abc123");
    const { result } = renderHook(() => useDrawerURL());
    act(() => result.current.close());
    expect(result.current.runId).toBeNull();
  });
});
