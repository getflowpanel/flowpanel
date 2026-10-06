// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { ToastContext } from "../../_feedback/toast-api";
import { LabelsProvider } from "../../_provider/LabelsContext";
import { InlineEditCell } from "../InlineEditCell";

afterEach(cleanup);

const editButtons = () => screen.getAllByRole("button", { name: "Edit Name" });
const editButton = () => screen.getByRole("button", { name: "Edit Name" });
const editing = () => screen.queryByDisplayValue("Alice") !== null;

function inRow(rowClickable: boolean) {
  const onRowClick = vi.fn();
  const onRowKeyDown = vi.fn();
  render(
    // biome-ignore lint/a11y/noStaticElementInteractions: test harness stands in for DataTableRow's <tr onClick> and the keyboard-navigable <tbody>.
    <div onClick={onRowClick} onKeyDown={onRowKeyDown}>
      <InlineEditCell
        resource="users"
        id="1"
        field="name"
        value="Alice"
        {...(rowClickable ? { rowClickable: true } : {})}
      />
    </div>,
  );
  return { onRowClick, onRowKeyDown };
}

describe("InlineEditCell in a row that does not open", () => {
  it("is one button named after the action, holding the value and the pencil", () => {
    inRow(false);
    expect(editButtons()).toHaveLength(1);
    expect(editButton().textContent).toBe("Alice");
    expect(editButton().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("edits on a pointer click without reaching the row", () => {
    const { onRowClick } = inRow(false);
    fireEvent.click(editButton(), { detail: 1 });
    expect(editing()).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it.each(["Enter", " "])("edits on %j without bubbling to the row", (key) => {
    const { onRowKeyDown } = inRow(false);
    fireEvent.keyDown(editButton(), { key });
    expect(editing()).toBe(true);
    expect(onRowKeyDown).not.toHaveBeenCalled();
  });

  it("does not edit on a double click event of its own", () => {
    inRow(false);
    fireEvent.doubleClick(editButton());
    expect(editing()).toBe(false);
  });

  it("returns focus to the button when editing is cancelled", () => {
    inRow(false);
    editButton().focus();
    fireEvent.click(editButton(), { detail: 1 });
    const input = screen.getByDisplayValue("Alice");
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).toBe(editButton());
  });
});

describe("InlineEditCell in a clickable row", () => {
  it("shows the value as plain text and the pencil as the one edit button", () => {
    inRow(true);
    expect(editButtons()).toHaveLength(1);
    expect(screen.getByText("Alice").closest("button")).toBeNull();
    expect(screen.getByText("Alice").hasAttribute("aria-label")).toBe(false);
    expect(editButton().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(editButton().hasAttribute("tabindex")).toBe(false);
  });

  it("lets a pointer click on the value open the row instead of editing", () => {
    const { onRowClick } = inRow(true);
    fireEvent.click(screen.getByText("Alice"), { detail: 1 });
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(editing()).toBe(false);
  });

  it("opens the row on a real double click and never starts editing", () => {
    const { onRowClick } = inRow(true);
    const text = screen.getByText("Alice");
    fireEvent.click(text, { detail: 1 });
    fireEvent.click(text, { detail: 2 });
    fireEvent.doubleClick(text, { detail: 2 });
    expect(onRowClick).toHaveBeenCalled();
    expect(editing()).toBe(false);
  });

  it("edits from a pointer click on the pencil without opening the row", () => {
    const { onRowClick } = inRow(true);
    fireEvent.click(editButton(), { detail: 1 });
    expect(editing()).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("edits when assistive technology activates the pencil", () => {
    const { onRowClick } = inRow(true);
    fireEvent.click(editButton(), { detail: 0 });
    expect(editing()).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it.each(["Enter", " "])("edits on %j on the pencil without opening the record", (key) => {
    const { onRowClick, onRowKeyDown } = inRow(true);
    editButton().focus();
    fireEvent.keyDown(editButton(), { key });
    expect(editing()).toBe(true);
    expect(onRowKeyDown).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("returns focus to the pencil when editing is cancelled", () => {
    inRow(true);
    fireEvent.keyDown(editButton(), { key: "Enter" });
    fireEvent.keyDown(screen.getByDisplayValue("Alice"), { key: "Escape" });
    expect(document.activeElement).toBe(editButton());
  });

  it("keeps the pencil visible while it has focus", () => {
    inRow(true);
    expect(editButton().className).toContain("group-focus-within/edit:opacity-100");
  });
});

describe("InlineEditCell request URL", () => {
  it("escapes the resource and the identifier instead of routing on them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ ok: true }) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    render(<InlineEditCell resource="user profile" id="a/b#c" field="name" value="Alice" />);
    fireEvent.click(editButton(), { detail: 1 });
    fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Bob" } });
    fireEvent.blur(screen.getByDisplayValue("Bob"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/flowpanel/user%20profile/a%2Fb%23c/update");
    vi.unstubAllGlobals();
  });
});

describe("InlineEditCell save failure", () => {
  it("toasts the field's own message, such as a taken value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: false,
          error: "Validation failed",
          fieldErrors: { name: "Name is already taken" },
        }),
      } as unknown as Response),
    );
    const error = vi.fn();
    const noop = () => undefined;
    render(
      <ToastContext.Provider
        value={{ error, success: noop, info: noop, warning: noop, dismiss: noop }}
      >
        <InlineEditCell resource="users" id="1" field="name" value="Alice" />
      </ToastContext.Provider>,
    );
    fireEvent.click(editButton(), { detail: 1 });
    fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Bob" } });
    fireEvent.blur(screen.getByDisplayValue("Bob"));
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith("Name is already taken"));
    vi.unstubAllGlobals();
  });
});

describe("InlineEditCell's words", () => {
  it("names the edit button after the column label, in the admin's language", () => {
    render(
      <LabelsProvider value={{ table: { editCell: "Изменить: {label}" } }}>
        <InlineEditCell resource="users" id="1" field="full_name" label="Имя" value="Alice" />
      </LabelsProvider>,
    );
    expect(screen.getByRole("button", { name: "Изменить: Имя" })).toBeTruthy();
  });
});
