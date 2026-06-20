// @vitest-environment jsdom
//
// Unlike `Form.test.tsx` (happy-dom, and the `FormActionDispatchContext`
// test-only bypass documented there), `jsdom` DOES let React 19's real
// `<form action={fn}>` interception run for a genuine DOM `click` on the
// submit button (verified empirically before writing this file — happy-dom
// does not do this; jsdom does). So this test drives the actual user
// gesture — type, blur, click — through the real dispatch path, not a
// dispatcher shortcut. It's the first test in this repo to exercise that
// path, which the `happy-dom`-based tests structurally cannot reach.
//
// Covers, all three together in one pass, via a real `fireEvent.click`:
//   1. a real click on the submit button reaches `serverAction` (a real
//      `fetch` call happens, not just a validate-intent's early return),
//   2. every other field's typed `.value` survives a rejected submit, and
//   3. the rejected field's server error renders (`role="alert"`).
// Browser-verified end to end against this same controlled-fields
// architecture, including the per-field-error-rendering and full
// create-then-persist path — see the form's changeset for the trace.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Field } from "../Field.js";
import { Form } from "../Form.js";
import { FormSubmit } from "../FormSubmit.js";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Form — a real click on Create, through React 19's actual <form action>", () => {
  const schema = z.object({
    sku: z.unknown().optional(),
    title: z.unknown().optional(),
    ourPriceCents: z.unknown().optional(),
    userId: z.unknown().optional(),
  });

  it("submits on a real click, keeps other fields' values, and renders the field error — together", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: false,
        error: "Validation failed",
        fieldErrors: { userId: "Customer is required" },
      }),
    });

    render(
      <Form action="/api/flowpanel/products/create" schema={schema}>
        <Field name="sku" label="SKU" />
        <Field name="title" label="Product" />
        <Field name="ourPriceCents" label="Our price" />
        <Field name="userId" label="Customer" />
        <FormSubmit>Create</FormSubmit>
      </Form>,
    );

    const sku = screen.getByLabelText("SKU") as HTMLInputElement;
    const title = screen.getByLabelText("Product") as HTMLInputElement;
    const price = screen.getByLabelText("Our price") as HTMLInputElement;
    const button = screen.getByRole("button", { name: /create/i });

    // A real operator types these in, in order, ending on `price` — leaving
    // it focused, same as a real browser would. `fireEvent.focusOut`
    // (bubbling, unlike `fireEvent.blur`) is what actually reaches
    // conform's document-level `focusout` listener, which turns focus
    // leaving an unvalidated field into a hidden `__intent__=validate`
    // resubmit — the same thing moving focus to the submit button triggers.
    act(() => {
      fireEvent.focus(sku);
      fireEvent.change(sku, { target: { value: "SKU-77002" } });
      fireEvent.focusOut(sku);
      fireEvent.focus(title);
      fireEvent.change(title, { target: { value: "Input Preservation Probe" } });
      fireEvent.focusOut(title);
      fireEvent.focus(price);
      fireEvent.change(price, { target: { value: "54321" } });
    });

    // Moving focus to the submit button fires `focusOut` on the
    // last-focused field first, synchronously, before `click` — same order
    // a real `mousedown`-then-`click` gesture produces.
    act(() => {
      fireEvent.focusOut(price);
      fireEvent.click(button);
    });

    // (1) The real submission's fetch — proves the click actually reached
    // `serverAction`'s network branch, not just a validate-intent early
    // return (which never calls `fetch`).
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/flowpanel/products/create");

    // (3) The error renders.
    await waitFor(() => expect(screen.getByText("Customer is required")).toBeTruthy());
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Customer is required");

    // (2) Every OTHER field still shows exactly what was typed — asserted
    // in the SAME pass as the error assertion above.
    expect(sku.value).toBe("SKU-77002");
    expect(title.value).toBe("Input Preservation Probe");
    expect(price.value).toBe("54321");
  });
});
