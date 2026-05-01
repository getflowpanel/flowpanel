// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Drawer, DrawerContent, DrawerHeader } from "../Drawer.js";

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        onOpenChange?.(v);
      }}
      title="Test drawer"
    >
      <DrawerHeader>
        <h2>Header</h2>
      </DrawerHeader>
      <DrawerContent>
        <p>Body content</p>
      </DrawerContent>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    render(
      <Drawer open={false} onOpenChange={() => {}}>
        <DrawerContent>hidden</DrawerContent>
      </Drawer>,
    );
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("renders body + header when open", () => {
    render(<Harness />);
    expect(screen.getByText("Header")).toBeTruthy();
    expect(screen.getByText("Body content")).toBeTruthy();
  });

  it("exposes an accessible close button", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /close drawer/i })).toBeTruthy();
  });

  it("calls onOpenChange(false) when ESC is pressed", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) when close button is clicked", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: /close drawer/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
