// @vitest-environment happy-dom

import { parseWithZod } from "@conform-to/zod/v4";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Field } from "../Field.js";
import { buildSubmissionReply, Form, FormActionDispatchContext } from "../Form.js";
import { FormError } from "../FormError.js";
import { FormSubmit } from "../FormSubmit.js";

// `Form` calls `useRouter()` unconditionally (for `redirectTo` navigation on a
// successful submit), so every render needs the app-router context mocked —
// see `FormProps.redirectTo`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// NOTE on how submission is driven below: a real click / `form.requestSubmit()`
// does NOT reach `serverAction` in this project's test environment — happy-dom
// falls through to the `action="javascript:…"` progressive-enhancement guard
// React itself sets on the `<form>` DOM node instead of running React 19's
// `<form action={fn}>` interception (confirmed empirically: clicking,
// `fireEvent.submit`, a manually-constructed `SubmitEvent` with `submitter`,
// and `form.requestSubmit()` all fail the same way, even with happy-dom's own
// navigation fallback disabled). So the tests that need a REAL submission
// through `useActionState` invoke the exact same dispatcher React would have
// called, via `FormActionDispatchContext` (`@internal`, test-only — see its
// doc comment in `Form.tsx`), instead of a DOM event.
function ActionCapture({ onReady }: { onReady: (dispatch: (fd: FormData) => void) => void }) {
  const dispatch = React.useContext(FormActionDispatchContext);
  React.useEffect(() => {
    if (dispatch) onReady(dispatch);
  }, [dispatch, onReady]);
  return null;
}

describe("Form", () => {
  it("renders field and submit", () => {
    render(
      <Form action="/api/x" schema={z.object({ email: z.string().email() })}>
        <Field name="email" label="Email" />
        <FormSubmit>Save</FormSubmit>
      </Form>,
    );
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: /save/i })).toBeTruthy();
  });

  it("applies defaultValues to inputs", () => {
    render(
      <Form
        action="/api/x"
        schema={z.object({ email: z.string() })}
        defaultValues={{ email: "x@y.z" }}
      >
        <Field name="email" label="Email" />
      </Form>,
    );
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.defaultValue).toBe("x@y.z");
  });
});

describe("buildSubmissionReply", () => {
  // Regression test for a real bug: rejecting a submit because ONE field was
  // bad used to wipe every OTHER field the operator had already typed. The
  // wipe itself happens at the DOM level (React 19 resets an uncontrolled
  // `<form>` once the action settles, regardless of outcome — see the
  // `formGeneration` comment in `Form.tsx`), but that fix only helps if the
  // *reply* actually carries the submitted values back for conform to
  // re-seed on remount. This asserts that half of the contract directly
  // against a real `parseWithZod` submission, without a DOM submit event.
  const schema = z.object({
    sku: z.unknown().optional(),
    title: z.unknown().optional(),
    ourPriceCents: z.unknown().optional(),
    userId: z.unknown().optional(),
  });

  function submissionFor(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const submission = parseWithZod(fd, { schema });
    if (submission.status !== "success") {
      throw new Error("expected a successful client-side parse (permissive schema)");
    }
    return submission;
  }

  it("preserves every submitted field when the server rejects only one of them", () => {
    const submission = submissionFor({
      sku: "SKU-99001",
      title: "Browser Submit Probe",
      ourPriceCents: "12345",
      userId: "", // the one field the operator left empty
    });
    const result = buildSubmissionReply(submission, {
      ok: false,
      error: "Validation failed",
      fieldErrors: { userId: "Customer is required" },
    });
    expect(result.status).toBe("error");
    expect(result.error?.userId).toEqual(["Customer is required"]);
    // The regression: sku/title/ourPriceCents must come back in `initialValue`
    // even though only `userId` failed server-side validation.
    expect(result.initialValue?.sku).toBe("SKU-99001");
    expect(result.initialValue?.title).toBe("Browser Submit Probe");
    expect(result.initialValue?.ourPriceCents).toBe("12345");
  });

  it("preserves submitted values on a network error too", () => {
    const submission = submissionFor({ sku: "SKU-1", title: "Widget" });
    const result = buildSubmissionReply(submission, {
      ok: false,
      error: "Network error — please try again.",
    });
    expect(result.initialValue?.sku).toBe("SKU-1");
    expect(result.initialValue?.title).toBe("Widget");
    expect(result.error?.[""]).toEqual(["Network error — please try again."]);
  });

  it("carries no error on a successful reply", () => {
    const submission = submissionFor({ sku: "SKU-1" });
    const result = buildSubmissionReply(submission, { ok: true });
    expect(result.status).toBe("success");
    expect(result.initialValue?.sku).toBe("SKU-1");
  });

  // Regression test: a failed response whose body has neither `error` nor
  // `fieldErrors` used to produce an entirely empty reply — Save appeared to
  // do nothing at all.
  it("falls back to a generic message when a failed reply carries no error at all", () => {
    const submission = submissionFor({ sku: "SKU-1" });
    const result = buildSubmissionReply(submission, { ok: false });
    expect(result.status).toBe("error");
    expect(result.error?.[""]).toEqual(["Something went wrong — please try again."]);
  });
});

describe("Form — rejected submit through the real useActionState/useForm path", () => {
  // This is the test the `buildSubmissionReply` reply-shape assertions above
  // are NOT sufficient to replace: the reply carrying the right values back
  // is only half the fix. This renders `<Form>` for real, TYPES into each
  // field via `fireEvent.change` (every `Field` control is conform-
  // CONTROLLED now — `value` + `onChange` via `useInputControl`, see
  // `Field.tsx`'s `useStringControl` doc comment — so a typed value is
  // carried forward by the control's own React state, not by the server
  // reply's `initialValue`; hand-building a `FormData` object, the previous
  // approach here, never exercises that path and so never actually
  // discriminated between broken and fixed code), drives an ACTUAL
  // submission through `useActionState` (see `ActionCapture` above), and
  // asserts BOTH halves of the contract IN THE SAME PASS:
  //
  //   (a) every OTHER field's value is still what was typed, AND
  //   (b) the rejected field's server error is rendered with `role="alert"`.
  //
  // A version of `Form`/`Field` satisfying only one of these — the
  // wiped-uncontrolled-input bug this file's `formGeneration` remount used
  // to fix, or the remount-discards-conform's-live-error-state bug that fix
  // introduced — fails this test. See `Form.tsx`'s top-of-file comment for
  // why neither an uncontrolled field nor a remount can satisfy both.
  //
  // NOTE on why this also asserts DOM node identity, not just `.value`: this
  // harness drives the submission through `FormActionDispatchContext` (see
  // its doc comment in `Form.tsx`) rather than a real DOM submit event,
  // because happy-dom doesn't intercept React 19's `<form action={fn}>` the
  // way a browser does — and that also means happy-dom never runs React 19's
  // own post-action-settle reset of *uncontrolled* fields, the actual thing
  // that wipes values in a real browser. So a `key`-remounted OLD/uncontrolled
  // `Form` can still pass a `.value`-only assertion here (the remount
  // re-seeds `defaultValue` from a fresh `lastResult.initialValue` — verified
  // empirically: this test, without the identity check below, passes against
  // the pre-fix `Form`/`Field` too). What a remount CANNOT hide from a test,
  // in ANY DOM implementation, is that it destroys and recreates the actual
  // `<input>` element. Capturing the element reference before the submit and
  // re-querying after it settles catches exactly the mechanism this fix
  // removes, independent of whether this environment reproduces React's
  // native reset.
  const schema = z.object({
    sku: z.unknown().optional(),
    title: z.unknown().optional(),
    ourPriceCents: z.unknown().optional(),
    userId: z.unknown().optional(),
  });

  it("keeps every OTHER field's value AND renders the rejected field's error, together", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: false,
        error: "Validation failed",
        fieldErrors: { userId: "Customer is required" },
      }),
    });

    let dispatch: ((fd: FormData) => void) | null = null;
    render(
      <Form action="/api/flowpanel/products/create" schema={schema}>
        <ActionCapture
          onReady={(fn) => {
            dispatch = fn;
          }}
        />
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
    const userId = screen.getByLabelText("Customer") as HTMLInputElement;

    // A real operator types these in — dispatch real `change` events instead
    // of hand-building the submitted `FormData`, so this exercises the exact
    // path a browser keystroke does.
    fireEvent.change(sku, { target: { value: "SKU-77002" } });
    fireEvent.change(title, { target: { value: "Input Preservation Probe" } });
    fireEvent.change(price, { target: { value: "54321" } });
    // `userId` (the Customer reference) is left empty — the one field the
    // server will reject.

    const fd = new FormData();
    fd.set("sku", sku.value);
    fd.set("title", title.value);
    fd.set("ourPriceCents", price.value);
    fd.set("userId", userId.value);

    await act(async () => {
      React.startTransition(() => {
        dispatch?.(fd);
      });
    });

    // Wait for the (mocked) fetch round-trip and the resulting re-render.
    await waitFor(() => expect(screen.getByText("Customer is required")).toBeTruthy());

    // (b) the error renders with the right role — not just text somewhere.
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Customer is required");
    // (a) every OTHER field still shows exactly what was typed, in the SAME
    // pass as the error assertion above.
    expect(sku.value).toBe("SKU-77002");
    expect(title.value).toBe("Input Preservation Probe");
    expect(price.value).toBe("54321");
    // The mechanism check: no remount happened. `sku` was captured BEFORE
    // the submit — if `Form` still forced a `key`-remount of the subtree,
    // this would now be a stale, detached reference and re-querying the DOM
    // would return a DIFFERENT `<input>` element.
    expect(screen.getByLabelText("SKU")).toBe(sku);
  });
});

describe("Form — a non-2xx response with an empty JSON body still surfaces a message", () => {
  // Regression test for the reported failure mode: `Form` never checked
  // `response.ok`, so a non-2xx response whose body has no `error` key left
  // `buildSubmissionReply` with nothing to say — Save silently did nothing.
  it("shows the generic fallback instead of staying silent", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    let dispatch: ((fd: FormData) => void) | null = null;
    render(
      <Form
        action="/api/flowpanel/products/create"
        schema={z.object({ sku: z.unknown().optional() })}
      >
        <ActionCapture
          onReady={(fn) => {
            dispatch = fn;
          }}
        />
        <Field name="sku" label="SKU" />
        <FormError />
        <FormSubmit>Create</FormSubmit>
      </Form>,
    );

    const fd = new FormData();
    fd.set("sku", "SKU-1");
    await act(async () => {
      React.startTransition(() => {
        dispatch?.(fd);
      });
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong — please try again.");
  });
});
