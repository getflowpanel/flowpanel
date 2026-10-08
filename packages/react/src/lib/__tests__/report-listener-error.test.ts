import { afterEach, describe, expect, it, vi } from "vitest";
import { reportListenerError } from "../report-listener-error";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reportListenerError", () => {
  it("hands the error to reportError when the runtime has it", () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    const error = new Error("listener broke");
    reportListenerError(error);
    expect(report).toHaveBeenCalledWith(error);
  });

  it("rethrows it on a microtask otherwise, so the caller keeps going", () => {
    vi.stubGlobal("reportError", undefined);
    const scheduled: (() => void)[] = [];
    vi.stubGlobal("queueMicrotask", (task: () => void) => scheduled.push(task));
    const error = new Error("listener broke");
    expect(() => reportListenerError(error)).not.toThrow();
    expect(scheduled).toHaveLength(1);
    expect(() => scheduled[0]?.()).toThrow(error);
  });
});
