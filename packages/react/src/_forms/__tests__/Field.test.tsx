// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "../Field.js";
import { FormContext } from "../Form.js";

afterEach(cleanup);

const baseFields = {
  meta: { id: "f-meta", name: "meta", value: '{"a":1}', errors: [] as string[] },
  tags: { id: "f-tags", name: "tags", value: "red,blue", errors: [] as string[] },
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
