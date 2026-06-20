// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncSelect } from "../AsyncSelect.js";

afterEach(cleanup);

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
