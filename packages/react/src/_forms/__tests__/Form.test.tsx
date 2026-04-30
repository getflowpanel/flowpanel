// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Field } from "../Field.js";
import { Form } from "../Form.js";
import { FormSubmit } from "../FormSubmit.js";

afterEach(() => cleanup());

describe("Form", () => {
  it("renders field and submit", () => {
    render(
      <Form action={async () => ({ ok: true })} schema={z.object({ email: z.string().email() })}>
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
        action={async () => ({ ok: true })}
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
