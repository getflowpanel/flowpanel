// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { FIT_MOST_PX, fitToWidest, widestCellPx } from "../widest-cell";

afterEach(() => vi.restoreAllMocks());

describe("Fit to widest", () => {
  it("measures the widest value of a column on screen, padding included", () => {
    const table = document.createElement("table");
    table.innerHTML = `<tbody>
      <tr><td data-fp-field="name" style="padding: 0 16px">short</td><td data-fp-field="email">a@b.co</td></tr>
      <tr><td data-fp-field="name" style="padding: 0 16px">a much longer customer name</td><td data-fp-field="email">x</td></tr>
    </tbody>`;
    document.body.append(table);
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockImplementation(function (this: Range) {
      return { width: (this.startContainer.textContent ?? "").length * 10 } as DOMRect;
    });
    expect(widestCellPx(table, "name")).toBe(27 * 10 + 32);
    expect(widestCellPx(null, "name")).toBe(0);
    table.remove();
  });

  it("goes past the server's 26 rem guess for a long value, up to a cap", () => {
    expect(fitToWidest(424, 492)).toBe(492);
    expect(fitToWidest(424, 300)).toBe(424);
    expect(fitToWidest(424, 5_000)).toBe(FIT_MOST_PX);
  });
});
