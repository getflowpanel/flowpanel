// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionFormDialog } from "../ActionFormDialog";
import type { ActionFormField } from "../action-form-field";

afterEach(cleanup);

function renderDialog(fields: ActionFormField[], onSubmit = vi.fn().mockResolvedValue(null)) {
  render(
    <ActionFormDialog
      title="Reassign"
      submitLabel="Run"
      fields={fields}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe("ActionFormDialog — canonical controls", () => {
  it("does not emit a Radix accessibility warning when description is omitted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderDialog([{ name: "note", label: "Note", type: "text" }]);

    await waitFor(() =>
      expect(warn.mock.calls.flat().join(" ")).not.toMatch(/Missing `Description`/),
    );
    warn.mockRestore();
  });

  it("type=reference renders the AsyncSelect picker, not a text box", async () => {
    renderDialog([
      {
        name: "assignee",
        label: "Assignee",
        type: "reference",
        options: [{ label: "Alex Admin", value: "4" }],
      },
    ]);
    const control = screen.getByRole("combobox", { name: "Assignee" });
    expect(control.tagName).not.toBe("INPUT");
    fireEvent.click(control);
    expect(await screen.findByText("Alex Admin")).toBeTruthy();
  });

  it("type=json renders the JSON editor seeded with an object, not a text box", () => {
    renderDialog([{ name: "meta", label: "Meta", type: "json" }]);
    const editor = screen.getByRole("textbox", { name: "Meta" }) as HTMLTextAreaElement;
    expect(editor.tagName).toBe("TEXTAREA");
  });

  it("type=radio renders one radio per option inside a labelled group", () => {
    renderDialog([
      {
        name: "priority",
        label: "Priority",
        type: "radio",
        options: [
          { label: "Low", value: "low" },
          { label: "High", value: "high" },
        ],
      },
    ]);
    expect(screen.getByRole("group", { name: "Priority" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("type=markdown renders a textarea rather than a single-line input", () => {
    renderDialog([{ name: "note", label: "Note", type: "markdown" }]);
    const control = screen.getByRole("textbox", { name: "Note" }) as HTMLTextAreaElement;
    expect(control.tagName).toBe("TEXTAREA");
    expect(String(control.rows)).toBe("8");
  });
});

describe("ActionFormDialog — submitted values", () => {
  it("submits a radio pick as the option value", async () => {
    const onSubmit = renderDialog([
      {
        name: "priority",
        type: "radio",
        options: [
          { label: "Low", value: "low" },
          { label: "High", value: "high" },
        ],
      },
    ]);
    fireEvent.click(screen.getAllByRole("radio")[1] as HTMLElement);
    fireEvent.submit(
      screen.getByRole("button", { name: "Run" }).closest("form") as HTMLFormElement,
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ priority: "high" }));
  });

  it("keeps the wire shapes the action route expects for every control type", async () => {
    const onSubmit = renderDialog([
      { name: "note", type: "text" },
      { name: "count", type: "number" },
      { name: "flag", type: "boolean" },
      { name: "tags", type: "tags" },
      { name: "labels", type: "multiselect", options: [{ label: "A", value: "a" }] },
    ]);
    fireEvent.submit(
      screen.getByRole("button", { name: "Run" }).closest("form") as HTMLFormElement,
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        note: "",
        count: "",
        flag: false,
        tags: [],
        labels: [],
      }),
    );
  });

  it("checks a boolean into `true` and a multiselect pick into an array", async () => {
    const onSubmit = renderDialog([
      { name: "flag", label: "Flag", type: "boolean" },
      {
        name: "labels",
        label: "Labels",
        type: "multiselect",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Flag" }));
    const [first] = screen.getAllByRole("checkbox").slice(1);
    fireEvent.click(first as HTMLElement);
    fireEvent.submit(
      screen.getByRole("button", { name: "Run" }).closest("form") as HTMLFormElement,
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ flag: true, labels: ["a"] }));
  });
});

describe("ActionFormDialog — errors", () => {
  it("wires a returned field error to the control it belongs to", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ assignee: "Pick someone" });
    renderDialog(
      [{ name: "assignee", label: "Assignee", type: "reference", options: [] }],
      onSubmit,
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Run" }).closest("form") as HTMLFormElement,
    );
    const message = await screen.findByText("Pick someone");
    const control = screen.getByRole("combobox", { name: "Assignee" });
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("renders a form-level error under the empty key as a banner", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ "": "Action failed" });
    renderDialog([{ name: "note", type: "text" }], onSubmit);
    fireEvent.submit(
      screen.getByRole("button", { name: "Run" }).closest("form") as HTMLFormElement,
    );
    expect(await screen.findByText("Action failed")).toBeTruthy();
  });
});
