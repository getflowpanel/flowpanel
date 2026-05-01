// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdminCommand } from "../../hooks/useAdminCommand.js";
import { type CommandGroupUI, CommandPalette } from "../CommandPalette.js";

afterEach(() => {
  cleanup();
});

function makeGroups(onSelectA: () => void): CommandGroupUI[] {
  return [
    {
      label: "Navigation",
      items: [
        { label: "Users", onSelect: onSelectA },
        { label: "Posts", onSelect: () => {} },
      ],
    },
    {
      label: "Theme",
      items: [{ label: "Toggle dark mode", onSelect: () => {} }],
    },
  ];
}

describe("CommandPalette", () => {
  it("renders groups and items when open", () => {
    render(<CommandPalette open onOpenChange={() => {}} groups={makeGroups(() => {})} />);
    expect(screen.getByText("Navigation")).toBeTruthy();
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByText("Posts")).toBeTruthy();
    expect(screen.getByText("Toggle dark mode")).toBeTruthy();
  });

  it("fires onSelect when item clicked", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open onOpenChange={() => {}} groups={makeGroups(onSelect)} />);
    fireEvent.click(screen.getByText("Users"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch with typed value", () => {
    const onSearch = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        groups={makeGroups(() => {})}
        onSearch={onSearch}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "use" } });
    expect(onSearch).toHaveBeenCalledWith("use");
  });
});

function Harness() {
  const { open, setOpen } = useAdminCommand();
  return (
    <div>
      <span data-testid="state">{open ? "OPEN" : "CLOSED"}</span>
      <button type="button" onClick={() => setOpen(false)}>
        close
      </button>
    </div>
  );
}

describe("useAdminCommand", () => {
  it("toggles open state on ⌘K", () => {
    render(<Harness />);
    expect(screen.getByTestId("state").textContent).toBe("CLOSED");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByTestId("state").textContent).toBe("OPEN");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByTestId("state").textContent).toBe("CLOSED");
  });

  it("supports Ctrl+K as well", () => {
    render(<Harness />);
    expect(screen.getByTestId("state").textContent).toBe("CLOSED");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(screen.getByTestId("state").textContent).toBe("OPEN");
  });
});
