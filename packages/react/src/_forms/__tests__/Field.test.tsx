// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Field } from "../Field.js";
import { Form, FormActionDispatchContext, FormContext } from "../Form.js";
import { FormSubmit } from "../FormSubmit.js";

afterEach(cleanup);

const baseFieldsTyped = {
  text: { id: "f-text", name: "text", value: "", errors: [] as string[] },
  meta: { id: "f-meta", name: "meta", value: '{"a":1}', errors: [] as string[] },
  tags: { id: "f-tags", name: "tags", value: '["red","blue"]', errors: [] as string[] },
  select: { id: "f-select", name: "select", value: "", errors: [] as string[] },
  ownerId: { id: "f-ownerId", name: "ownerId", value: "", errors: [] as string[] },
  flag: { id: "f-flag", name: "flag", value: "", errors: [] as string[] },
};
type FieldName = keyof typeof baseFieldsTyped;
const baseFields = baseFieldsTyped as never;

const ctx = { fields: baseFields, form: {} as never } as never;

function ctxWithError(name: FieldName) {
  return {
    fields: {
      ...baseFieldsTyped,
      [name]: { ...baseFieldsTyped[name], errors: ["Invalid"] },
    },
    form: {} as never,
  } as never;
}

const OPTIONS = [{ label: "Alex Admin", value: "4" }];
const SELECT_OPTIONS = [{ label: "A", value: "a" }];

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

describe("Field — tags/multiselect lossless list encoding", () => {
  // Regression test: the old bare comma-join couldn't tell "one tag containing
  // a comma" from "two tags" apart, and re-decoding trimmed padded values.
  it("a tag containing a comma renders as one chip, not two", () => {
    const value = JSON.stringify(["a,b"]);
    render(
      <FormContext.Provider
        value={
          {
            fields: { tags: { id: "f-tags", name: "tags", value, errors: [] } },
            form: {} as never,
          } as never
        }
      >
        <Field name="tags" type="tags" />
      </FormContext.Provider>,
    );
    expect(screen.getByText("a,b")).toBeTruthy();
    expect(screen.queryByText("a")).toBeNull();
  });

  it("removing one tag does not trim another tag's padding", () => {
    const value = JSON.stringify(["  padded  ", "x"]);
    const { container } = render(
      <FormContext.Provider
        value={
          {
            fields: { tags: { id: "f-tags", name: "tags", value, errors: [] } },
            form: {} as never,
          } as never
        }
      >
        <Field name="tags" type="tags" />
      </FormContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove x" }));
    const hidden = container.querySelector('input[type="hidden"][name="tags"]') as HTMLInputElement;
    expect(hidden.value).toBe(JSON.stringify(["  padded  "]));
  });

  it("multiselect: an option value containing a comma survives selecting a second option", () => {
    const options = [
      { label: "A, Inc.", value: "a,inc" },
      { label: "B", value: "b" },
    ];
    const { container } = render(
      <FormContext.Provider value={ctx}>
        <Field name="select" type="multiselect" options={options} label="Pick" />
      </FormContext.Provider>,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    const hidden = container.querySelector(
      'input[type="hidden"][name="select"]',
    ) as HTMLInputElement;
    expect(JSON.parse(hidden.value)).toEqual(["a,inc", "b"]);
  });
});

describe("Field — aria-required reaches the interactive control", () => {
  const cases: Array<{
    type: string;
    fieldName: FieldName;
    extra?: Record<string, unknown>;
    getControl: () => HTMLElement;
  }> = [
    { type: "text", fieldName: "text", getControl: () => screen.getByRole("textbox") },
    { type: "textarea", fieldName: "text", getControl: () => screen.getByRole("textbox") },
    {
      type: "select",
      fieldName: "select",
      extra: { options: SELECT_OPTIONS },
      getControl: () => screen.getByRole("combobox"),
    },
    { type: "json", fieldName: "meta", getControl: () => screen.getByRole("textbox") },
    { type: "tags", fieldName: "tags", getControl: () => screen.getByRole("textbox") },
    {
      type: "multiselect",
      fieldName: "select",
      extra: { options: SELECT_OPTIONS },
      getControl: () => screen.getByRole("group"),
    },
    {
      type: "reference",
      fieldName: "ownerId",
      extra: { options: OPTIONS },
      getControl: () => screen.getByRole("combobox"),
    },
    {
      type: "radio",
      fieldName: "select",
      extra: { options: SELECT_OPTIONS },
      getControl: () => screen.getByRole("group"),
    },
    { type: "checkbox", fieldName: "flag", getControl: () => screen.getByRole("checkbox") },
  ];

  it.each(cases)("type=$type", ({ type, fieldName, extra, getControl }) => {
    render(
      <FormContext.Provider value={ctx}>
        <Field name={fieldName} type={type as never} required {...(extra ?? {})} />
      </FormContext.Provider>,
    );
    expect(getControl().getAttribute("aria-required")).toBe("true");
  });
});

describe("Field — aria-invalid/aria-describedby reach the previously-skipped types", () => {
  const cases: Array<{
    type: string;
    fieldName: FieldName;
    extra?: Record<string, unknown>;
    getControl: () => HTMLElement;
  }> = [
    { type: "json", fieldName: "meta", getControl: () => screen.getByRole("textbox") },
    { type: "tags", fieldName: "tags", getControl: () => screen.getByRole("textbox") },
    {
      type: "multiselect",
      fieldName: "select",
      extra: { options: SELECT_OPTIONS },
      getControl: () => screen.getByRole("group"),
    },
    {
      type: "reference",
      fieldName: "ownerId",
      extra: { options: OPTIONS },
      getControl: () => screen.getByRole("combobox"),
    },
    {
      type: "radio",
      fieldName: "select",
      extra: { options: SELECT_OPTIONS },
      getControl: () => screen.getByRole("group"),
    },
  ];

  it.each(cases)("type=$type", ({ type, fieldName, extra, getControl }) => {
    render(
      <FormContext.Provider value={ctxWithError(fieldName)}>
        <Field name={fieldName} type={type as never} {...(extra ?? {})} />
      </FormContext.Provider>,
    );
    const el = getControl();
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("aria-describedby")).toBe(`f-${fieldName}-error`);
  });
});

describe("Field — help text survives a validation error and every server message renders", () => {
  it("keeps the help text mounted, described-by both help and error ids", () => {
    render(
      <FormContext.Provider value={ctxWithError("text")}>
        <Field name="text" type="text" help="Use your legal name" />
      </FormContext.Provider>,
    );
    expect(screen.getByText("Use your legal name")).toBeTruthy();
    const control = screen.getByRole("textbox");
    expect(control.getAttribute("aria-describedby")).toBe("f-text-help f-text-error");
  });

  it("renders every zod error message for the field, not just the first", () => {
    const ctxTwoErrors = {
      fields: {
        ...baseFieldsTyped,
        text: { ...baseFieldsTyped.text, errors: ["Too short", "Must be alphanumeric"] },
      },
      form: {} as never,
    } as never;
    render(
      <FormContext.Provider value={ctxTwoErrors}>
        <Field name="text" type="text" />
      </FormContext.Provider>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Too short");
    expect(alert.textContent).toContain("Must be alphanumeric");
  });
});

describe("Field — label association does not point at a hidden input", () => {
  it.each([
    { type: "json", fieldName: "meta" as const, getControl: () => screen.getByRole("textbox") },
    { type: "tags", fieldName: "tags" as const, getControl: () => screen.getByRole("textbox") },
    {
      type: "reference",
      fieldName: "ownerId" as const,
      extra: { options: OPTIONS },
      getControl: () => screen.getByRole("combobox"),
    },
  ])("type=$type: visible control owns field.id, no hidden input keeps it", ({
    type,
    fieldName,
    extra,
    getControl,
  }: {
    type: string;
    fieldName: FieldName;
    extra?: Record<string, unknown>;
    getControl: () => HTMLElement;
  }) => {
    const { container } = render(
      <FormContext.Provider value={ctx}>
        <Field name={fieldName} label="My Label" type={type as never} {...(extra ?? {})} />
      </FormContext.Provider>,
    );
    const label = container.querySelector("label");
    const control = getControl();
    expect(label?.getAttribute("for")).toBe(control.id);
    expect(control.id).toBeTruthy();
    const hiddenInput = container.querySelector('input[type="hidden"]');
    expect(hiddenInput?.hasAttribute("id")).toBe(false);
    // `getByLabelText` matches via `<label for>` OR `aria-label` independently — it
    // doesn't compute the real accessible name, so it would resolve the control here
    // even with a competing `aria-label` still set (verified: this line alone does
    // NOT catch that regression). The discriminating check is that no `aria-label`
    // survives on a control that already has a `<label>` — per the accname spec,
    // `aria-label` wins over `<label for>`, so if both were present the announced
    // name would be the placeholder, not "My Label".
    expect(screen.getByLabelText("My Label")).toBe(control);
    expect(control.hasAttribute("aria-label")).toBe(false);
  });

  it("type=reference without a `label` prop: the combobox keeps an accessible name (aria-label fallback), not zero", () => {
    render(
      <FormContext.Provider value={ctx}>
        <Field name="ownerId" type="reference" options={OPTIONS} placeholder="Pick a customer" />
      </FormContext.Provider>,
    );
    const control = screen.getByRole("combobox");
    expect(control.getAttribute("aria-label")).toBe("Pick a customer");
  });

  it.each([
    {
      type: "multiselect",
      fieldName: "select" as const,
      extra: { options: SELECT_OPTIONS },
    },
    {
      type: "radio",
      fieldName: "select" as const,
      extra: { options: SELECT_OPTIONS },
    },
  ])("type=$type: group carries role=group + aria-labelledby to the label", ({
    type,
    fieldName,
    extra,
  }) => {
    const { container } = render(
      <FormContext.Provider value={ctx}>
        <Field name={fieldName} label="My Label" type={type as never} {...extra} />
      </FormContext.Provider>,
    );
    const group = screen.getByRole("group");
    const label = container.querySelector("label");
    expect(label?.id).toBeTruthy();
    expect(group.getAttribute("aria-labelledby")).toBe(label?.id);
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

describe("Field — an unrelated re-render mid-search does not restart the debounce", () => {
  // Regression test: `options = []` as `Field`'s default parameter used to be a
  // fresh array literal on every call, so a parent re-render (conform re-renders
  // the whole form on every keystroke elsewhere) rebuilt `loadOptions` and reset
  // `AsyncSelect`'s debounce timer — the reference search could be starved
  // indefinitely while the popover stayed open.
  it("fires the search once, on schedule, even after Field re-renders without new options", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ options: [{ label: "Match", value: "m1" }] }),
      });

      function Harness({ tick }: { tick: number }) {
        return (
          <FormContext.Provider value={ctx}>
            <div data-tick={tick} />
            <Field
              name="ownerId"
              type="reference"
              referenceSearchUrl="/api/flowpanel/orders/reference/ownerId"
            />
          </FormContext.Provider>
        );
      }

      const { rerender } = render(<Harness tick={0} />);
      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "a" } });

      // Halfway through the 200ms debounce, force Field to re-render — the same
      // shape of update conform's onInput revalidation causes on every keystroke.
      await vi.advanceTimersByTimeAsync(100);
      rerender(<Harness tick={1} />);
      await vi.advanceTimersByTimeAsync(150);

      // The original timer (due at 200ms) must have fired by 250ms elapsed —
      // it must not have been reset to 300ms by the re-render.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
