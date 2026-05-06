// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "../Toast.js";

afterEach(cleanup);

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success("Saved")}>
        ping-success
      </button>
      <button type="button" onClick={() => toast.error("Bad")}>
        ping-error
      </button>
    </div>
  );
}

describe("Toast", () => {
  it("renders a success toast after useToast().success", async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("ping-success"));
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("renders an error toast after useToast().error", async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("ping-error"));
    expect(await screen.findByText("Bad")).toBeTruthy();
  });
});
