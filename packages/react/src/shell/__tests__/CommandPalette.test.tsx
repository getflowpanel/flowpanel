// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdminCommand } from "../../hooks/useAdminCommand";
import { LabelsProvider } from "../../provider/LabelsContext";
import { type CommandGroupUI, CommandPalette as LazyPalette } from "../CommandPalette";
import { CommandPaletteDialog as CommandPalette } from "../CommandPaletteDialog";
import { paletteScore } from "../palette-score";

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
  it("shows a frame that holds the focus while the dialog loads, and Escape closes it", async () => {
    const onOpenChange = vi.fn();
    render(<LazyPalette open onOpenChange={onOpenChange} groups={[]} />);
    const shell = screen.getByRole("textbox", { name: "Command palette" });
    expect(shell.getAttribute("placeholder")).toBe("Loading…");
    expect(document.activeElement).toBe(shell);
    fireEvent.keyDown(shell, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("combobox")).toBeTruthy();
  });

  it("loads nothing until it first opens, then the dialog", async () => {
    const { container, rerender } = render(
      <LazyPalette open={false} onOpenChange={() => {}} groups={[]} />,
    );
    expect(container.innerHTML).toBe("");
    rerender(<LazyPalette open onOpenChange={() => {}} groups={[]} />);
    expect(await screen.findByRole("combobox")).toBeTruthy();
  });

  it("keeps the default English search and empty copy without a provider", () => {
    render(<CommandPalette open onOpenChange={() => {}} groups={[]} />);
    expect(screen.getByRole("combobox").getAttribute("placeholder")).toBe(
      "Search resources, actions…",
    );
    expect(screen.getByText("No results.")).toBeTruthy();
  });
  it("uses configured search, empty and accessible text with explicit placeholder precedence", () => {
    const labels = {
      palette: {
        placeholder: "Найти команду…",
        noResults: "Ничего не найдено",
        title: "Команды",
        description: "Поиск команд админки",
        loading: "Загрузка…",
      },
    };
    const { rerender } = render(
      <LabelsProvider value={labels}>
        <CommandPalette open onOpenChange={() => {}} groups={[]} itemsLoading />
      </LabelsProvider>,
    );
    expect(
      screen.getByRole("dialog", { name: "Команды", description: "Поиск команд админки" }),
    ).toBeTruthy();
    expect(screen.getByRole("combobox").getAttribute("placeholder")).toBe("Найти команду…");
    expect(screen.getByText("Загрузка…")).toBeTruthy();
    // While records load, "nothing found" would contradict the spinner.
    expect(screen.queryByText("Ничего не найдено")).toBeNull();
    rerender(
      <LabelsProvider value={labels}>
        <CommandPalette open onOpenChange={() => {}} groups={[]} placeholder="" />
      </LabelsProvider>,
    );
    expect(screen.getByRole("combobox").getAttribute("placeholder")).toBe("");
    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
  });
  it("renders groups and items when open", () => {
    render(<CommandPalette open onOpenChange={() => {}} groups={makeGroups(() => {})} />);
    expect(
      screen.getByRole("dialog", {
        name: "Command palette",
        description: "Search and run admin commands",
      }),
    ).toBeTruthy();
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

describe("palette ranking", () => {
  it("puts exact and prefix matches first and drops letters merely in order", () => {
    const record = paletteScore("/admin/products/7", "Retro", ["Retro Tee", "retro"]);
    const prefix = paletteScore("Retro Tee", "Retro");
    const inner = paletteScore("Order items", "items");
    expect(record).toBe(1);
    expect(prefix).toBeLessThan(record);
    expect(inner).toBeLessThan(prefix);
    expect(paletteScore("Categories", "Retro", ["/admin/categories"])).toBe(0);
    expect(paletteScore("Toggle dark mode", "Retro")).toBe(0);
  });
});
