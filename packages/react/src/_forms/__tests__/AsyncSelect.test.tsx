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
});
