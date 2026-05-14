// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Drawer } from "../Drawer.js";

describe("Drawer — a11y contract", () => {
  it("renders a dialog with an accessible name from title", () => {
    render(
      <Drawer open onOpenChange={() => {}} title="Edit user">
        <p>body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    // Radix wires aria-labelledby to the Title element
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    // The title text should be present in the document
    expect(screen.getByText("Edit user")).toBeTruthy();
  });

  it("provides a fallback accessible name when no title prop given", () => {
    render(
      <Drawer open onOpenChange={() => {}}>
        <p>body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    // Fallback title text is "Drawer"
    expect(screen.getByText("Drawer")).toBeTruthy();
  });

  it("renders a labeled close button", () => {
    render(
      <Drawer open onOpenChange={() => {}} title="X">
        <p>body</p>
      </Drawer>,
    );
    const close = screen.getByRole("button", { name: /close/i });
    expect(close).toBeTruthy();
    expect(close.getAttribute("aria-label")).toBe("Close drawer");
  });

  it("does not render children content when open is false", () => {
    render(
      <Drawer open={false} onOpenChange={() => {}} title="X">
        <p>closed-body-sentinel</p>
      </Drawer>,
    );
    // Radix may keep a hidden dialog node in DOM; children should not be visible
    expect(screen.queryByText("closed-body-sentinel")).toBeNull();
  });
});
