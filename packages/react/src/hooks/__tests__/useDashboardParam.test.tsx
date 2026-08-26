// @vitest-environment happy-dom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const push = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { useDashboardParam } from "../useDashboardParam";

function harness<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  const seen: { value: T; setValue: (n: T) => void; pending: boolean }[] = [];
  function Probe() {
    const r = useDashboardParam(key, schema, fallback);
    seen.push(r);
    return null;
  }
  render(<Probe />);
  return seen;
}

afterEach(() => {
  cleanup();
  push.mockReset();
  currentSearch = "";
});

describe("useDashboardParam", () => {
  const range = z.enum(["24h", "7d", "30d"]);

  it("returns the fallback when the param is absent", () => {
    const seen = harness("range", range, "24h");
    expect(seen[0]!.value).toBe("24h");
  });

  it("reads and validates the param from the URL", () => {
    currentSearch = "range=7d";
    const seen = harness("range", range, "24h");
    expect(seen[0]!.value).toBe("7d");
  });

  it("falls back when the URL value fails validation", () => {
    currentSearch = "range=bogus";
    const seen = harness("range", range, "24h");
    expect(seen[0]!.value).toBe("24h");
  });

  it("coerces numbers via z.coerce", () => {
    currentSearch = "page=3";
    const seen = harness("page", z.coerce.number().int().min(1), 1);
    expect(seen[0]!.value).toBe(3);
  });

  it("setValue pushes with the new param and scroll:false", () => {
    const seen = harness("range", range, "24h");
    act(() => seen[0]!.setValue("30d"));
    expect(push).toHaveBeenCalledTimes(1);
    const [href, opts] = push.mock.calls[0]!;
    expect(href).toBe("/admin?range=30d");
    expect(opts).toEqual({ scroll: false });
  });

  it("setValue drops the param when it equals the fallback (clean URL)", () => {
    currentSearch = "range=7d";
    const seen = harness("range", range, "24h");
    act(() => seen[0]!.setValue("24h"));
    const [href] = push.mock.calls[0]!;
    // Param removed → bare pathname.
    expect(href).toBe("/admin");
  });

  it("setValue preserves unrelated params", () => {
    currentSearch = "tab=runs&range=7d";
    const seen = harness("range", range, "24h");
    act(() => seen[0]!.setValue("30d"));
    const [href] = push.mock.calls[0]!;
    expect(href).toContain("tab=runs");
    expect(href).toContain("range=30d");
  });
});
