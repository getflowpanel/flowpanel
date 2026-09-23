import type { RequestContext } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { columnRenders, prerenderEach } from "../prerender";

const reqCtx = {} as RequestContext;

describe("prerenderEach", () => {
  it("runs the renders concurrently", async () => {
    let inFlight = 0;
    let peak = 0;
    const render = async (value: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return value;
    };
    const renders = new Map([
      ["a", () => render("A")],
      ["b", () => render("B")],
      ["c", () => render("C")],
    ]);
    expect(await prerenderEach(renders, {}, reqCtx)).toEqual({ a: "A", b: "B", c: "C" });
    expect(peak).toBe(3);
  });

  it("leaves out a render that throws and keeps the rest", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const renders = columnRenders([
      { field: "ok", render: () => "fine" },
      {
        field: "bad",
        render: () => {
          throw new Error("boom");
        },
      },
      "plain",
    ]);
    expect(await prerenderEach(renders, {}, reqCtx)).toEqual({ ok: "fine" });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
