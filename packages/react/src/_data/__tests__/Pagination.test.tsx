// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DefaultPagination, pageItems } from "../PaginationDefault";

afterEach(() => cleanup());

describe("pageItems", () => {
  it("lists every page when they all fit", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps first, last and a window around the cursor", () => {
    expect(pageItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  it("widens the window instead of stranding a lone page next to a gap", () => {
    // A naive window would emit [1, "gap", 2, 3] — a gap hiding nothing.
    expect(pageItems(2, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
    expect(pageItems(11, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
  });

  it("holds a constant length while the cursor crosses the middle", () => {
    const widths = [4, 5, 6, 7, 8, 9].map((p) => pageItems(p, 12).length);
    expect(new Set(widths).size).toBe(1);
  });

  it("handles the degenerate counts", () => {
    expect(pageItems(1, 0)).toEqual([]);
    expect(pageItems(1, 1)).toEqual([1]);
  });
});

describe("DefaultPagination", () => {
  it("renders nothing for a single page with no size picker", () => {
    const { container } = render(<DefaultPagination page={1} pageSize={20} total={12} />);
    expect(container.firstChild).toBeNull();
  });

  it("jumps straight to a numbered page", () => {
    const onChange = vi.fn();
    render(<DefaultPagination page={1} pageSize={10} total={100} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Page 10" }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("marks the current page for assistive tech and does not re-emit it", () => {
    const onChange = vi.fn();
    render(<DefaultPagination page={3} pageSize={10} total={100} onChange={onChange} />);
    const current = screen.getByRole("button", { name: "Page 3" });
    expect(current.getAttribute("aria-current")).toBe("page");
    fireEvent.click(current);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the step buttons at each end", () => {
    const disabled = (name: string) =>
      (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
    const { unmount } = render(<DefaultPagination page={1} pageSize={10} total={100} />);
    expect(disabled("Previous page")).toBe(true);
    expect(disabled("Next page")).toBe(false);
    unmount();
    render(<DefaultPagination page={10} pageSize={10} total={100} />);
    expect(disabled("Next page")).toBe(true);
  });

  it("shows the size picker only when it can act", () => {
    const { unmount } = render(
      <DefaultPagination page={1} pageSize={10} total={100} pageSizeOptions={[10, 20]} />,
    );
    expect(screen.queryByLabelText("Rows per page")).toBeNull();
    unmount();
    render(
      <DefaultPagination
        page={1}
        pageSize={10}
        total={100}
        pageSizeOptions={[10, 20]}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Rows per page")).toBeTruthy();
  });
});
