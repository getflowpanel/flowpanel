// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Drawer, DrawerTitle } from "../Drawer";

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
    expect(screen.getByText("Record")).toBeTruthy();
  });

  it("focuses the panel itself on open, so no ring lands on the close button", async () => {
    render(
      <Drawer open onOpenChange={() => {}} title="X">
        <button type="button">Inside</button>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(dialog);
  });

  it("renders a labeled close button", () => {
    render(
      <Drawer open onOpenChange={() => {}} title="X">
        <p>body</p>
      </Drawer>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toBeTruthy();
  });

  it("names itself once, by its visible DrawerTitle, with no hidden duplicate", () => {
    render(
      <Drawer open onOpenChange={() => {}} title="Fallback">
        <DrawerTitle>Ann</DrawerTitle>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog");
    const heading = document.getElementById(dialog.getAttribute("aria-labelledby") ?? "");
    expect(heading?.textContent).toBe("Ann");
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.queryByText("Fallback")).toBeNull();
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
