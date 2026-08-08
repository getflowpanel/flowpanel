// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ToastProvider } from "../Toast.js";
import { useToast } from "../toast-api.js";

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
  it("keeps a toast fired before the renderer chunk lands", async () => {
    function OnMount() {
      const toast = useToast();
      useEffect(() => {
        toast.success("Queued");
      }, [toast]);
      return null;
    }
    render(
      <ToastProvider>
        <OnMount />
      </ToastProvider>,
    );
    expect(await screen.findByText("Queued")).toBeTruthy();
  });
});
