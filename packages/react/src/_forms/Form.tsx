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
import { cn } from "../lib/cn";

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
  /** Where to navigate after a successful submit (e.g. back to the list, or to the created row). */
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
        const body = (await response.json()) as Partial<FormActionResult>;
        // A non-2xx response is always a failure, regardless of what the body
        // claims — `ok` must be assigned after the spread to win over it.
        res = { ...body, ok: response.ok ? (body.ok ?? true) : false };
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

/** Shown when a failed submit's JSON body carries neither `error` nor `fieldErrors`. */
const GENERIC_FAILURE_MESSAGE = "Something went wrong — please try again.";

/** Turn the JSON `{ ok, error?, fieldErrors? }` response into a conform SubmissionResult. */
export function buildSubmissionReply(
  submission: { reply: (options?: ReplyShapeOptions) => SubmissionResult<string[]> },
  res: FormActionResult,
): SubmissionResult<string[]> {
  if (!res.ok) {
    const hasFieldErrors = Boolean(res.fieldErrors && Object.keys(res.fieldErrors).length > 0);
    const message = res.error ?? (hasFieldErrors ? undefined : GENERIC_FAILURE_MESSAGE);
    return submission.reply({
      ...(message ? { formErrors: [message] } : {}),
      ...(hasFieldErrors
        ? {
            fieldErrors: Object.fromEntries(
              Object.entries(res.fieldErrors as Record<string, string>).map(([k, v]) => [k, [v]]),
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
