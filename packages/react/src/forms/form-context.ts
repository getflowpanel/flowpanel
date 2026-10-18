"use client";
import type { FieldMetadata, FormMetadata } from "@conform-to/react";
import * as React from "react";

export interface FormContextValue {
  form: FormMetadata<Record<string, unknown>>;
  fields: Record<string, FieldMetadata<unknown>>;
  isSubmitting: boolean;
}

/** @internal Exposed for test harnesses so Field can be rendered without Form. */
export const FormContext = React.createContext<FormContextValue | null>(null);

export const FormActionDispatchContext = React.createContext<((formData: FormData) => void) | null>(
  null,
);

export function useFormContext(): FormContextValue {
  const ctx = React.useContext(FormContext);
  if (!ctx) throw new Error("Form children must be rendered inside <Form>");
  return ctx;
}

const subscribeNever = () => () => {};

/** Whether a form's code runs here: false while a server-rendered form waits to hydrate, so its controls stay inert. */
export const FormReadyContext = React.createContext(true);

export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function useFormReady(): boolean {
  return React.useContext(FormReadyContext);
}
