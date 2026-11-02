// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToastProvider } from "../../feedback/Toast";
import { Field } from "../Field";
import { Form } from "../Form";
import { confirmLeave } from "../leave-guard";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../../feedback/ConfirmDialog", () => {
  throw new Error("chunk failed to load");
});
vi.mock("../../feedback/ToasterMount", () => {
  throw new Error("chunk failed to load");
});

afterEach(cleanup);

function dirtyForm() {
  render(
    <ToastProvider>
      <Form
        action="/api/flowpanel/users/create"
        schema={z.object({ name: z.unknown().optional() })}
      >
        <Field name="name" label="Name" />
      </Form>
    </ToastProvider>,
  );
  act(() => {
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Ann" } });
  });
}

describe("lazy chunks that fail to load", () => {
  it("keep the page, and the leave guard falls back to the browser's confirm", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    dirtyForm();
    const proceed = vi.fn();
    act(() => confirmLeave(proceed));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toBeTruthy();

    confirm.mockReturnValue(true);
    act(() => confirmLeave(proceed));
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1));
    confirm.mockRestore();
  });
});
