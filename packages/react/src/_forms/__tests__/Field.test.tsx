// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Field } from "../Field.js";
import { Form, FormActionDispatchContext, FormContext } from "../Form.js";
import { FormSubmit } from "../FormSubmit.js";

afterEach(cleanup);

const baseFields = {
  meta: { id: "f-meta", name: "meta", value: '{"a":1}', errors: [] as string[] },
  tags: { id: "f-tags", name: "tags", value: "red,blue", errors: [] as string[] },
  ownerId: { id: "f-ownerId", name: "ownerId", value: "", errors: [] as string[] },
} as never;

const ctx = { fields: baseFields, form: {} as never } as never;

describe("Field — json/tags dispatch", () => {
  it("renders JsonEditor for type=json", () => {
    render(
      <FormContext.Provider value={ctx}>
        <Field name="meta" type="json" />
      </FormContext.Provider>,
    );
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.value).toContain('"a": 1');
  });

  it("renders TagInput for type=tags", () => {
    render(
      <FormContext.Provider value={ctx}>
        <Field name="tags" type="tags" />
      </FormContext.Provider>,
    );
    expect(screen.getByText("red")).toBeTruthy();
    expect(screen.getByText("blue")).toBeTruthy();
  });
});

// `Form` calls `useRouter()` unconditionally.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Same test-only dispatcher pattern as `Form.test.tsx` — happy-dom doesn't
// intercept React 19's `<form action={fn}>`, so submission has to be driven
// through the real `useActionState` dispatcher directly (see
// `FormActionDispatchContext`'s doc comment in `Form.tsx`).
function ActionCapture({ onReady }: { onReady: (dispatch: (fd: FormData) => void) => void }) {
  const dispatch = React.useContext(FormActionDispatchContext);
  React.useEffect(() => {
    if (dispatch) onReady(dispatch);
  }, [dispatch, onReady]);
  return null;
}

describe("Field — reference control revalidates after a rejected submit", () => {
  // Regression test for a real bug: after a server rejection, `FormSubmit`
  // stayed disabled (`form.valid === false`) even after the operator picked
  // a value in the `reference` picker — the one field they were told to fix.
  //
  // The actual end-to-end outcome ("picking a value re-enables the button")
  // is what matters and what a real browser was used to confirm fixed. It
  // can't be asserted directly in this suite: re-enabling the button
  // requires conform's client-side revalidation round trip, which submits a
  // hidden `__intent__=validate` button via `form.requestSubmit()` — and (as
  // established in `Form.test.tsx`) happy-dom doesn't honor React 19's
  // `<form action={fn}>` interception, so ANY `requestSubmit()` in this
  // environment — for a plain text field exhibiting the *working* behavior
  // just as much as for the reference picker — dead-ends before conform can
  // apply the result, regardless of this fix.
  //
  // What IS reliably testable, and is the actual mechanism the bug report
  // and the fix are about, is whether picking a value triggers conform's
  // revalidation AT ALL — i.e. whether `requestSubmit()` gets called (with a
  // `validate` intent for this field) in the first place. Before this fix, a
  // React-controlled hidden `<input>`'s `value` prop change updated the DOM
  // directly during reconciliation without ever dispatching a native `input`
  // event, so conform's document-level listener never saw it and
  // `requestSubmit()` was never even attempted. `useInputControl` dispatches
  // a real one. Asserting only "the form is invalid after a server error"
  // would pass on both the broken and fixed code; this asserts the one thing
  // that differs between them.
  it("selecting a reference option triggers conform's revalidation (a requestSubmit with a validate intent for the field)", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: false,
        error: "Validation failed",
        fieldErrors: { userId: "Customer is required" },
      }),
    });

    let dispatch: ((fd: FormData) => void) | null = null;
    render(
      <Form
        action="/api/flowpanel/products/create"
        schema={z.object({ userId: z.unknown().optional() })}
      >
        <ActionCapture
          onReady={(fn) => {
            dispatch = fn;
          }}
        />
        <Field
          name="userId"
          label="Customer"
          type="reference"
          options={[{ label: "Alex Admin", value: "4" }]}
        />
        <FormSubmit>Create</FormSubmit>
      </Form>,
    );

    const fd = new FormData();
    fd.set("userId", "");
    await act(async () => {
      React.startTransition(() => {
        dispatch?.(fd);
      });
    });
    await waitFor(() => expect(screen.getByText("Customer is required")).toBeTruthy());

    const button = screen.getByRole("button", { name: /create/i }) as HTMLButtonElement;
    // Reproduces the reported dead end: rejected, and still disabled.
    expect(button.disabled).toBe(true);

    // `requestSubmit` is how conform's `dispatch()` runs a client-side
    // "validate" intent (see @conform-to/dom's `form.mjs`). Stub it to a
    // no-op — happy-dom's real implementation dead-ends past this point
    // (unrelated to this fix, see the block comment above) — so this test
    // only asserts it was *called*, with the right intent.
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});

    // Pick a reference option — a real click through the picker, same as a
    // user would, not a direct state mutation.
    fireEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByText("Alex Admin");
    fireEvent.click(option);

    await waitFor(() => expect(requestSubmit).toHaveBeenCalled());
    const submitter = requestSubmit.mock.calls[0]?.[0] as HTMLButtonElement | undefined;
    expect(submitter?.name).toBe("__intent__"); // conform-to/dom's INTENT constant
    const intent = JSON.parse(submitter?.value ?? "{}") as {
      type?: string;
      payload?: { name?: string };
    };
    expect(intent.type).toBe("validate");
    expect(intent.payload?.name).toBe("userId");

    requestSubmit.mockRestore();
  });
});

describe("Field — reference control search endpoint", () => {
  it("searches `referenceSearchUrl` and renders the returned options, not a local filter", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, options: [{ label: "Remote Match", value: "r1" }] }),
    });
    render(
      <FormContext.Provider value={ctx}>
        <Field
          name="ownerId"
          type="reference"
          options={[{ label: "Stale Local Option", value: "l1" }]}
          referenceSearchUrl="/api/flowpanel/orders/reference/ownerId"
        />
      </FormContext.Provider>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Remote Match");
    expect(screen.queryByText("Stale Local Option")).toBeNull();
    const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
    expect(calledUrl).toMatch(/^\/api\/flowpanel\/orders\/reference\/ownerId\?q=/);
  });

  it("falls back to filtering the preloaded `options` when no `referenceSearchUrl` is given", async () => {
    fetchMock.mockClear();
    render(
      <FormContext.Provider value={ctx}>
        <Field name="ownerId" type="reference" options={[{ label: "Local Only", value: "l1" }]} />
      </FormContext.Provider>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByText("Local Only");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
