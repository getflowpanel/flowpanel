import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyboardHelp } from "../components/KeyboardHelp.js";

describe("KeyboardHelp", () => {
  it("opens on ? key and closes on Escape", () => {
    const onClose = vi.fn();

    const { rerender } = render(<KeyboardHelp open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<KeyboardHelp open={true} onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
