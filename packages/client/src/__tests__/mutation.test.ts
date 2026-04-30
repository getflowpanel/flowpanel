// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdminMutation } from "../mutation.js";

afterEach(() => cleanup());

describe("useAdminMutation", () => {
  it("runs the action and calls onSuccess on ok result", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, message: "done" });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAdminMutation(action, { onSuccess }));

    await act(async () => {
      const res = await result.current.run("arg");
      expect(res).toEqual({ ok: true, message: "done" });
    });

    expect(action).toHaveBeenCalledWith("arg");
    expect(onSuccess).toHaveBeenCalledWith({ ok: true, message: "done" });
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces error via onError when action returns { ok: false }", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "nope" });
    const onError = vi.fn();
    const { result } = renderHook(() => useAdminMutation(action, { onError }));

    await act(async () => {
      const res = await result.current.run();
      expect(res).toEqual({ ok: false, error: "nope" });
    });

    expect(onError).toHaveBeenCalledWith("nope");
    expect(result.current.error).toBe("nope");
  });

  it("catches thrown errors and returns ok: false", async () => {
    const action = vi.fn().mockRejectedValue(new Error("boom"));
    const onError = vi.fn();
    const { result } = renderHook(() => useAdminMutation(action, { onError }));

    await act(async () => {
      const res = await result.current.run();
      expect(res).toEqual({ ok: false, error: "boom" });
    });

    expect(onError).toHaveBeenCalledWith("boom");
    expect(result.current.error).toBe("boom");
  });

  it("toggles pending during the call", async () => {
    let resolve: (v: { ok: true }) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<{ ok: true }>((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useAdminMutation(action as any));

    let runPromise: Promise<unknown>;
    act(() => {
      runPromise = result.current.run();
    });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      resolve({ ok: true });
      await runPromise;
    });
    expect(result.current.pending).toBe(false);
  });

  it("reset clears error and pending", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "x" });
    const { result } = renderHook(() => useAdminMutation(action));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe("x");

    act(() => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });
});
