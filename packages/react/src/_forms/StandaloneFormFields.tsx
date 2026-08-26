"use client";
import type { FieldMetadata } from "@conform-to/react";
import * as React from "react";
import { FormContext, type FormContextValue } from "./Form";

export interface StandaloneFormFieldsProps {
  /** `id` of the `<form>` these controls live in — they associate with it and write their value back into it. */
  formId: string;
  /** Field names to expose, matching the `FormField` children rendered inside. */
  names: readonly string[];
  /** Server-reported message per field name, rendered exactly like a validation error. */
  errors?: Record<string, string>;
  children: React.ReactNode;
}

/** The subset of conform's `FieldMetadata` that `FormField` and its controls read. */
interface StandaloneFieldMetadata {
  id: string;
  name: string;
  formId: string;
  errorId: string;
  key: undefined;
  value: string;
  initialValue: string;
  errors?: string[];
}

/**
 * Render `FormField` controls outside a schema-driven `<Form>` — for a plain
 * form that collects its own `FormData` on submit, such as the action dialog.
 * Every field starts empty; the `<form>` element is the value store.
 */
export function StandaloneFormFields({
  formId,
  names,
  errors,
  children,
}: StandaloneFormFieldsProps) {
  const value = React.useMemo<FormContextValue>(() => {
    const fields: Record<string, FieldMetadata<unknown>> = {};
    for (const name of names) {
      const id = `${formId}-${name}`;
      const message = errors?.[name];
      const meta: StandaloneFieldMetadata = {
        id,
        name,
        formId,
        errorId: `${id}-error`,
        key: undefined,
        value: "",
        initialValue: "",
        ...(message !== undefined ? { errors: [message] } : {}),
      };
      fields[name] = meta as unknown as FieldMetadata<unknown>;
    }
    return { form: {} as FormContextValue["form"], fields, isSubmitting: false };
  }, [formId, names, errors]);

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}
