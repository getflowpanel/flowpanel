// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkBar } from "../BulkBar.js";

afterEach(cleanup);

describe("BulkBar", () => {
  it("renders nothing when selection is empty", () => {
    const { container } = render(
      <BulkBar
        selection={[]}
        actions={[{ key: "x", label: "X", onClick: vi.fn() }]}
        onClear={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders selection count + action buttons + Clear", () => {
    render(
      <BulkBar
        selection={["1", "2", "3"]}
        actions={[{ key: "disable", label: "Disable", variant: "destructive", onClick: vi.fn() }]}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText(/3 selected/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /disable/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /clear/i })).toBeTruthy();
  });

  it("invokes action onClick with the full selection", () => {
    const onAction = vi.fn();
    render(
      <BulkBar
        selection={["1", "2"]}
        actions={[{ key: "x", label: "X", onClick: onAction }]}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(onAction).toHaveBeenCalledWith(["1", "2"]);
  });

  it("clear button calls onClear", () => {
    const onClear = vi.fn();
    render(<BulkBar selection={["1"]} actions={[]} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
