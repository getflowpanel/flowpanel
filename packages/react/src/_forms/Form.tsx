"use client";
import {
  type DefaultValue,
  type FieldMetadata,
  type FormMetadata,
  getFormProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { $ZodType, output as zOutput } from "zod/v4/core";
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
  isSubmitting: boolean;
}

const FormCtx = React.createContext<FormContextValue | null>(null);

/** @internal Exposed for test harnesses so Field can be rendered without Form. */
export const FormContext = FormCtx;

export const FormActionDispatchContext = React.createContext<((formData: FormData) => void) | null>(
  null,
);

export function useFormContext(): FormContextValue {
  const ctx = React.useContext(FormCtx);
  if (!ctx) throw new Error("Form children must be rendered inside <Form>");
  return ctx;
}

export interface FormProps<S extends $ZodType> {
  action: string;
  schema: S;
  defaultValues?: Partial<zOutput<S>>;
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** row or list. */
  redirectTo?: string;
}

export function Form<S extends $ZodType>({
  action,
  schema,
  defaultValues,
  children,
  className,
  id,
  redirectTo,
}: FormProps<S>) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const serverAction: ServerAction = React.useCallback(
    async (_prev, formData) => {
      const submission = parseWithZod(formData, { schema });
      if (submission.status !== "success") {
        return submission.reply({ resetForm: false });
      }
      let res: FormActionResult;
      setIsSubmitting(true);
      try {
        const response = await fetch(action, { method: "POST", body: formData });
        res = (await response.json()) as FormActionResult;
      } catch {
        res = { ok: false, error: "Network error — please try again." };
      } finally {
        setIsSubmitting(false);
      }
      if (res.ok && redirectTo) router.push(redirectTo);
      return buildSubmissionReply(submission, res);
    },
    [action, schema, redirectTo, router],
  );

  const [lastResult, formAction] = React.useActionState(serverAction, null);

  type UseFormOpts = Parameters<typeof useForm<Record<string, unknown>>>[0];
  const onValidate: NonNullable<UseFormOpts["onValidate"]> = ({ formData }) =>
    parseWithZod(formData, { schema }) as ReturnType<NonNullable<UseFormOpts["onValidate"]>>;
  const formOpts: UseFormOpts = {
    lastResult: lastResult ?? undefined,
    onValidate,
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
      isSubmitting,
    }),
    [form, fields, isSubmitting],
  );

  const formProps = getFormProps(form);
  return (
    <FormActionDispatchContext.Provider value={formAction}>
      <FormCtx.Provider value={ctxValue}>
        <form {...formProps} action={formAction} className={cn("space-y-4", className)}>
          {children}
        </form>
      </FormCtx.Provider>
    </FormActionDispatchContext.Provider>
  );
}

/** Turn the JSON `{ ok, error?, fieldErrors? */
export function buildSubmissionReply(
  submission: { reply: (options?: ReplyShapeOptions) => SubmissionResult<string[]> },
  res: FormActionResult,
): SubmissionResult<string[]> {
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
  return submission.reply();
}

interface ReplyShapeOptions {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
}
