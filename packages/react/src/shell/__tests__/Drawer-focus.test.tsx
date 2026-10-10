// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Drawer } from "../Drawer";

afterEach(cleanup);

describe("Drawer focus on close", () => {
  it("gives focus back to the element that opened it", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Opener
          </button>
          <Drawer open={open} onOpenChange={setOpen} title="X">
            <p>body</p>
          </Drawer>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Opener" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("falls back to returnFocus when nothing had focus, as when the URL opened it", async () => {
    const row = document.createElement("tr");
    row.tabIndex = -1;
    document.body.appendChild(row);
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <Drawer open={open} onOpenChange={setOpen} title="X" returnFocus={() => row}>
          <p>body</p>
        </Drawer>
      );
    }
    render(<Harness />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(row));
    row.remove();
  });
});
