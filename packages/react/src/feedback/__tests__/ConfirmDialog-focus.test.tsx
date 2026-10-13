// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DefaultConfirmDialog, splitConfirmText } from "../ConfirmDialogDefault";

afterEach(cleanup);

describe("DefaultConfirmDialog", () => {
  it("splits a two-sentence prompt into a heading and a line under it", () => {
    expect(splitConfirmText("Delete 3 monitors? This cannot be undone.", undefined)).toEqual({
      heading: "Delete 3 monitors?",
      detail: "This cannot be undone.",
    });
    expect(splitConfirmText("Disable customer?", undefined)).toEqual({
      heading: "Disable customer?",
      detail: undefined,
    });
  });

  it("has no hidden filler description when the prompt is one sentence", () => {
    render(
      <DefaultConfirmDialog
        open
        onOpenChange={() => {}}
        title="Disable customer?"
        onConfirm={() => {}}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("gives focus back to the button that opened it", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Disable customer
          </button>
          <DefaultConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Disable customer?"
            onConfirm={() => {}}
          />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Disable customer" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
