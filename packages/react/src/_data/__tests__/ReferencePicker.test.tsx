// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferencePicker } from "../ReferencePicker.js";

afterEach(cleanup);

describe("ReferencePicker", () => {
  it("renders placeholder when value is null", () => {
    render(
      <ReferencePicker
        value={null}
        onChange={vi.fn()}
        search={async () => []}
        placeholder="Pick…"
      />,
    );
    expect(screen.getByRole("combobox", { name: /pick/i })).toBeTruthy();
  });

  it("opens on click and shows search results from the callback", async () => {
    const search = vi.fn(async (q: string) =>
      [
        { id: "1", label: "Ada" },
        { id: "2", label: "Bob" },
      ].filter((r) => r.label.toLowerCase().includes(q.toLowerCase())),
    );
    render(<ReferencePicker value={null} onChange={vi.fn()} search={search} />);
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(await screen.findByText("Ada")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("calls onChange with the picked id on selection", async () => {
    const onChange = vi.fn();
    const search = async () => [{ id: "42", label: "The Answer" }];
    render(<ReferencePicker value={null} onChange={onChange} search={search} />);
    fireEvent.click(screen.getByRole("combobox"));
    const item = await screen.findByText("The Answer");
    fireEvent.click(item);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("42"));
  });
});
