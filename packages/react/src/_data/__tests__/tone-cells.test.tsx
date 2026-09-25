// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderFormatCell } from "../render-format";

afterEach(cleanup);

describe("threshold cells", () => {
  it("colours the cell text in each tone", () => {
    const tones = { warn: 0.3, err: 0.5 };
    const { container } = render(
      <>
        {renderFormatCell({ kind: "percent", tones }, 0.1)}
        {renderFormatCell({ kind: "percent", tones }, 0.4)}
        {renderFormatCell({ kind: "percent", tones }, 0.6)}
      </>,
    );
    const cells = [...container.querySelectorAll("[data-tone]")];
    expect(cells.map((cell) => cell.getAttribute("data-tone"))).toEqual(["ok", "warn", "err"]);
    expect(cells[2]?.className).toContain("text-fp-err-text");
    expect(cells.map((cell) => cell.textContent)).toEqual(["10%", "40%", "60%"]);
  });

  it("keeps a plain percent cell plain", () => {
    const { container } = render(<>{renderFormatCell({ kind: "percent" }, 0.6)}</>);
    expect(container.querySelector("[data-tone]")).toBeNull();
  });
});
