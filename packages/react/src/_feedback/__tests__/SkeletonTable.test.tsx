// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkeletonTable } from "../SkeletonTable.js";

afterEach(cleanup);

describe("SkeletonTable", () => {
  it("renders the requested rows × columns shape", () => {
    render(<SkeletonTable rows={2} columns={3} />);
    const status = screen.getByRole("status", { name: /loading/i });
    expect(status).toBeTruthy();
    expect(status.getAttribute("aria-busy")).toBe("true");
    // header + 2 rows = 3 direct child divs
    const rowEls = Array.from(status.children).filter((el) => el.tagName === "DIV");
    expect(rowEls.length).toBe(3);
  });

  it("renders defaults when no props passed", () => {
    render(<SkeletonTable />);
    const status = screen.getByRole("status", { name: /loading/i });
    // header + 5 rows = 6 direct child divs
    const rowEls = Array.from(status.children).filter((el) => el.tagName === "DIV");
    expect(rowEls.length).toBe(6);
  });
});
