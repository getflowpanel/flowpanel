"use client";
import type { ColumnMeta } from "@flowpanel/core";
import type * as React from "react";
import type { z } from "zod";
import { Field } from "./Field.js";
import { Form, type FormActionResult } from "./Form.js";
import { FormError } from "./FormError.js";
import { FormSubmit } from "./FormSubmit.js";

type InputType = NonNullable<React.ComponentProps<typeof Field>["type"]>;

function inputTypeFor(meta: ColumnMeta): InputType {
  switch (meta.type) {
    case "number":
      return "number";
    case "date":
      return "datetime-local";
    case "enum":
      // Enum rendering would use <Select>; M1 keeps it as plain text until we expand Field.
      return "text";
    default:
      return "text";
  }
}

function humanize(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface AutoFormProps<S extends z.ZodTypeAny> {
  action: (state: FormActionResult | null, formData: FormData) => Promise<FormActionResult>;
  schema: S;
  columns: ColumnMeta[];
  hide?: string[];
  defaultValues?: Record<string, unknown>;
  submitLabel?: string;
  className?: string;
}

export function AutoForm<S extends z.ZodTypeAny>({
  action,
  schema,
  columns,
  hide = [],
  defaultValues,
  submitLabel = "Save",
  className,
}: AutoFormProps<S>) {
  const fields = columns.filter((c) => !c.primaryKey && !hide.includes(c.name));
  return (
    <Form
      action={action}
      schema={schema}
      {...(defaultValues ? { defaultValues: defaultValues as Partial<z.infer<S>> } : {})}
      {...(className ? { className } : {})}
    >
      {fields.map((c) => (
        <Field key={c.name} name={c.name} label={humanize(c.name)} type={inputTypeFor(c)} />
      ))}
      <FormError />
      <FormSubmit>{submitLabel}</FormSubmit>
    </Form>
  );
}
