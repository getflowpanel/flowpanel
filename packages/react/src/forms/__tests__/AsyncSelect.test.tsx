// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsyncSelect } from "../AsyncSelect";

const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const TIERS = [
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
  { label: "Scale", value: "scale" },
];

/** The trigger comes first in the document; the picker's search box is the second. */
const searchBox = (): HTMLElement => screen.getAllByRole("combobox")[1] as HTMLElement;

const activeIndex = (): number =>
  screen.getAllByRole("option").findIndex((o) => o.getAttribute("aria-selected") === "true");

async function openWith(options: { label: string; value: string }[], onChange = vi.fn()) {
  render(
    <AsyncSelect
      value={null}
      onChange={onChange}
      loadOptions={async () => options}
      debounceMs={0}
    />,
  );
  fireEvent.click(screen.getByRole("combobox"));
  if (options.length > 0) await screen.findByText(options[0]?.label as string);
  return { onChange };
}

describe("AsyncSelect", () => {
  it("renders placeholder when value is null", () => {
    render(
      <AsyncSelect
        value={null}
        onChange={vi.fn()}
        loadOptions={async () => []}
        placeholder="Select tier…"
      />,
    );
    expect(screen.getByRole("combobox", { name: /select tier/i })).toBeTruthy();
  });

  it("loads options and calls onChange with the picked value", async () => {
    const onChange = vi.fn();
    const loadOptions = async () => [{ label: "Pro", value: "pro" }];
    render(<AsyncSelect value={null} onChange={onChange} loadOptions={loadOptions} />);
    fireEvent.click(screen.getByRole("combobox"));
    const item = await screen.findByText("Pro");
    fireEvent.click(item);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("pro"));
  });

  it("moves the active option with the arrow keys and picks it with Enter", async () => {
    const { onChange } = await openWith(TIERS);
    const search = searchBox();
    expect(activeIndex()).toBe(0);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(activeIndex()).toBe(1);
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("pro"));
  });

  it("does not wrap past either end", async () => {
    await openWith(TIERS);
    const search = searchBox();
    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(activeIndex()).toBe(0);
    for (const _ of TIERS) fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(activeIndex()).toBe(TIERS.length - 1);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(activeIndex()).toBe(TIERS.length - 1);
  });

  it.each([
    { keys: [{ key: "End" }], index: 2, name: "End jumps to the last option" },
    { keys: [{ key: "End" }, { key: "Home" }], index: 0, name: "Home jumps back to the first" },
    { keys: [{ key: "n", ctrlKey: true }], index: 1, name: "Ctrl+N moves down" },
    { keys: [{ key: "j", ctrlKey: true }], index: 1, name: "Ctrl+J moves down" },
    {
      keys: [{ key: "End" }, { key: "p", ctrlKey: true }],
      index: 1,
      name: "Ctrl+P moves up",
    },
    {
      keys: [{ key: "End" }, { key: "k", ctrlKey: true }],
      index: 1,
      name: "Ctrl+K moves up",
    },
    {
      keys: [{ key: "ArrowDown", metaKey: true }],
      index: 2,
      name: "Meta+ArrowDown jumps to the last option",
    },
    {
      keys: [{ key: "End" }, { key: "ArrowUp", metaKey: true }],
      index: 0,
      name: "Meta+ArrowUp jumps to the first option",
    },
  ])("$name", async ({ keys, index }) => {
    await openWith(TIERS);
    const search = searchBox();
    for (const key of keys) fireEvent.keyDown(search, key);
    expect(activeIndex()).toBe(index);
  });

  it("scrolls the active option into view as it moves", async () => {
    await openWith(TIERS);
    scrollIntoView.mockClear();
    fireEvent.keyDown(searchBox(), { key: "End" });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.calls[0]?.[0]).toEqual({ block: "nearest" });
    expect(scrollIntoView.mock.instances[0]).toBe(screen.getAllByRole("option")[2]);
  });

  it("closes on Escape without selecting", async () => {
    const { onChange } = await openWith(TIERS);
    fireEvent.keyDown(searchBox(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on Tab without selecting, so focus can move on", async () => {
    const { onChange } = await openWith(TIERS);
    fireEvent.keyDown(searchBox(), { key: "Tab" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the combobox pointed at its listbox in every open state", async () => {
    const states = [
      { settled: () => screen.findAllByRole("option"), loadOptions: async () => TIERS },
      { settled: () => screen.findByText("No options"), loadOptions: async () => [] },
      {
        settled: () => screen.findByRole("alert"),
        loadOptions: async () => {
          throw new Error("network down");
        },
      },
    ];
    for (const { settled, loadOptions } of states) {
      render(
        <AsyncSelect value={null} onChange={vi.fn()} loadOptions={loadOptions} debounceMs={0} />,
      );
      fireEvent.click(screen.getByRole("combobox"));
      const search = searchBox();
      const wired = () => {
        expect(search.getAttribute("aria-expanded")).toBe("true");
        expect(search.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
      };
      // Before the load settles the picker is in its searching state.
      expect(screen.getByRole("status").textContent).toMatch(/searching/i);
      wired();
      await settled();
      wired();
      cleanup();
    }
  });

  it("carries the input hygiene a search box needs", async () => {
    await openWith(TIERS);
    const search = searchBox();
    expect(search.getAttribute("type")).toBe("text");
    expect(search.getAttribute("autocomplete")).toBe("off");
    expect(search.getAttribute("autocorrect")).toBe("off");
    expect(search.getAttribute("spellcheck")).toBe("false");
    expect(search.id).toBeTruthy();
  });

  it("announces an empty result through a live region, like searching and failure", async () => {
    render(
      <AsyncSelect
        value={null}
        onChange={vi.fn()}
        loadOptions={async () => []}
        debounceMs={0}
        emptyText="No matches"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("No matches");
    expect((await screen.findByRole("status")).textContent).toBe("No matches");
    // A listbox with no options is still the element `aria-controls` names.
    expect(screen.getByRole("listbox").children).toHaveLength(0);
  });

  it("shows the initial label on the trigger before the picker is ever opened", () => {
    render(
      <AsyncSelect
        value="u42"
        onChange={vi.fn()}
        loadOptions={async () => []}
        initialLabel="Alex Admin"
      />,
    );
    expect(screen.getByRole("combobox").textContent).toContain("Alex Admin");
  });

  it("shows a loading state while a search is in flight", async () => {
    let resolve!: (v: { label: string; value: string }[]) => void;
    const loadOptions = () => new Promise<{ label: string; value: string }[]>((r) => (resolve = r));
    render(
      <AsyncSelect value={null} onChange={vi.fn()} loadOptions={loadOptions} debounceMs={0} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect((await screen.findByRole("status")).textContent).toMatch(/searching/i);
    resolve([{ label: "Pro", value: "pro" }]);
    await screen.findByText("Pro");
  });

  it("shows a distinct error state when loadOptions rejects, not the empty-results text", async () => {
    const loadOptions = async () => {
      throw new Error("network down");
    };
    render(
      <AsyncSelect value={null} onChange={vi.fn()} loadOptions={loadOptions} debounceMs={0} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn't load/i);
    expect(screen.queryByText("No options")).toBeNull();
  });

  it("shows the empty-results text (not the error state) when a search legitimately finds nothing", async () => {
    render(
      <AsyncSelect
        value={null}
        onChange={vi.fn()}
        loadOptions={async () => []}
        debounceMs={0}
        emptyText="No matches"
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("No matches");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
