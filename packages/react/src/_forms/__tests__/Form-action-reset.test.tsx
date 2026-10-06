// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Field } from "../Field";
import { Form } from "../Form";
import { FormError } from "../FormError";
import { FormSubmit } from "../FormSubmit";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

describe("Form under StrictMode, as next dev renders it", () => {
  it("keeps a create form's server errors on screen through React's post-action reset", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: "Validation failed",
        fieldErrors: { email: "Email is required" },
      }),
    });
    render(
      <StrictMode>
        <Form action="/api/flowpanel/users/create" schema={z.object({ email: z.unknown() })}>
          <FormError />
          <Field name="email" label="Email" />
          <FormSubmit>Create</FormSubmit>
        </Form>
      </StrictMode>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /create/i }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await settle();
    // React resets a form after its action; in `next dev` that reset lands after the errors render.
    act(() => {
      screen
        .getByRole("button", { name: /create/i })
        .closest("form")
        ?.reset();
    });
    await settle();

    expect(screen.getByText("Email is required")).toBeTruthy();
    expect(screen.getByText("Validation failed")).toBeTruthy();
  });
});
