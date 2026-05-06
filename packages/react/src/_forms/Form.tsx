"use client";
import {
  type DefaultValue,
  type FieldMetadata,
  type FormMetadata,
  getFormProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import * as React from "react";
import type { z } from "zod";
import { cn } from "../lib/cn.js";

export interface FormActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

type ServerAction = (
  prev: SubmissionResult<string[]> | null | undefined,
  formData: FormData,
) => Promise<SubmissionResult<string[]> | null | undefined>;

export interface FormContextValue {
  form: FormMetadata<Record<string, unknown>>;
  fields: Record<string, FieldMetadata<unknown>>;
}

const FormCtx = React.createContext<FormContextValue | null>(null);

/** @internal Exposed for test harnesses so Field can be rendered without Form. */
export const FormContext = FormCtx;

export function useFormContext(): FormContextValue {
  const ctx = React.useContext(FormCtx);
  if (!ctx) throw new Error("Form children must be rendered inside <Form>");
  return ctx;
}

export interface FormProps<S extends z.ZodTypeAny> {
  action: (state: FormActionResult | null, formData: FormData) => Promise<FormActionResult>;
  schema: S;
  defaultValues?: Partial<z.infer<S>>;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Form<S extends z.ZodTypeAny>({
  action,
  schema,
  defaultValues,
  children,
  className,
  id,
}: FormProps<S>) {
  const serverAction: ServerAction = React.useCallback(
    async (_prev, formData) => {
      const submission = parseWithZod(formData, { schema });
      if (submission.status !== "success") {
        return submission.reply();
      }
      const res = await action(null, formData);
      if (!res.ok) {
        return submission.reply({
          ...(res.error ? { formErrors: [res.error] } : {}),
          ...(res.fieldErrors
            ? {
                fieldErrors: Object.fromEntries(
                  Object.entries(res.fieldErrors).map(([k, v]) => [k, [v]]),
                ),
              }
            : {}),
        });
      }
      return submission.reply({ resetForm: false });
    },
    [action, schema],
  );

  const [lastResult, formAction] = React.useActionState(serverAction, null);

  type UseFormOpts = Parameters<typeof useForm<Record<string, unknown>>>[0];
  const formOpts: UseFormOpts = {
    lastResult: lastResult ?? undefined,
    onValidate: ({ formData }) => parseWithZod(formData, { schema }),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    ...(defaultValues
      ? { defaultValue: defaultValues as DefaultValue<Record<string, unknown>> }
      : {}),
    ...(id ? { id } : {}),
  };
  const [form, fields] = useForm<Record<string, unknown>>(formOpts);

  const ctxValue = React.useMemo<FormContextValue>(
    () => ({
      form,
      fields: fields as unknown as Record<string, FieldMetadata<unknown>>,
    }),
    [form, fields],
  );

  const formProps = getFormProps(form);
  return (
    <FormCtx.Provider value={ctxValue}>
      <form {...formProps} action={formAction} className={cn("space-y-4", className)}>
        {children}
      </form>
    </FormCtx.Provider>
  );
}
