// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../ConfirmDialog.js";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("renders title + description when open", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete user?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Delete user?")).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete user?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("renders default labels Confirm/Cancel when not provided", () => {
    render(<ConfirmDialog open onOpenChange={() => {}} title="X" onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
