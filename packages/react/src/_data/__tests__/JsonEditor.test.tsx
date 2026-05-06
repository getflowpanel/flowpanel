// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonEditor } from "../JsonEditor.js";

afterEach(cleanup);

describe("JsonEditor", () => {
  it("renders initial value as pretty JSON in a textarea", () => {
    render(<JsonEditor value={{ a: 1 }} onChange={vi.fn()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe(`{\n  "a": 1\n}`);
  });

  it("calls onChange with the parsed object on valid edit", () => {
    const onChange = vi.fn();
    render(<JsonEditor value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: `{"a":1,"b":"x"}` } });
    expect(onChange).toHaveBeenCalledWith({ a: 1, b: "x" });
  });

  it("shows error message on invalid JSON and does NOT call onChange", () => {
    const onChange = vi.fn();
    render(<JsonEditor value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: `{bad` } });
    expect(screen.getByText(/invalid json/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aria-invalid reflects error state", () => {
    render(<JsonEditor value={{}} onChange={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: `{bad` } });
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(textarea, { target: { value: `{}` } });
    expect(textarea.getAttribute("aria-invalid")).toBe("false");
  });
});
