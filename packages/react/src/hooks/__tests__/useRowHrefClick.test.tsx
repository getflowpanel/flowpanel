// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { useRowHrefClick } from "../useRowNavigation";

describe("useRowHrefClick", () => {
  const rows = [{ id: "a" }, { id: "b" }];

  it("pushes the clicked row's href and ignores a null one", () => {
    const { result } = renderHook(() => useRowHrefClick(rows, ["/admin/x/a", null]));
    result.current?.(rows[1] as { id: string });
    expect(push).not.toHaveBeenCalled();
    result.current?.(rows[0] as { id: string });
    expect(push).toHaveBeenCalledWith("/admin/x/a");
  });

  it("returns no handler without hrefs", () => {
    const { result } = renderHook(() => useRowHrefClick(rows, undefined));
    expect(result.current).toBeUndefined();
  });
});
