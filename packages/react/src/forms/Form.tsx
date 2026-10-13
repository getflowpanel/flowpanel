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
import type { ResolvedLabels } from "@flowpanel/core/labels";
import { DEFAULT_LABELS } from "@flowpanel/core/labels";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import type { $ZodType, output as zOutput } from "zod/v4/core";
import { useToast } from "../feedback/toast-api";
import { cn } from "../lib/cn";
import { connectionMessage } from "../lib/connection-message";
import { useLabels } from "../provider/LabelsContext";
import { useLeaveGuard } from "./leave-guard";

export interface FormActionResult {
  ok: boolean;
  /** Stable row key returned after create; appended to redirects as a one-shot entry marker. */
  createdKey?: string;
  error?: string;
  /** The `FlowpanelErrorCode` of a failure. */
  code?: string;
  requestId?: string;
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
  /** Toast shown after a successful submit, such as "Customer created". */
  successMessage?: string;
}

/** Add the one-shot entry marker without losing filters, views, or hash fragments. */
export function redirectWithCreatedKey(redirectTo: string, createdKey?: string): string {
  if (!createdKey) return redirectTo;
  const hashIndex = redirectTo.indexOf("#");
  const beforeHash = hashIndex >= 0 ? redirectTo.slice(0, hashIndex) : redirectTo;
  const hash = hashIndex >= 0 ? redirectTo.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const params = new URLSearchParams(queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "");
  params.set("fp_created", createdKey);
  return `${path}?${params.toString()}${hash}`;
}

export function Form<S extends $ZodType>({
  action,
  schema,
  defaultValues,
  children,
  className,
  id,
  redirectTo,
  successMessage,
}: FormProps<S>) {
  const router = useRouter();
  const labels = useLabels();
  const toast = useToast();
  const lockRef = React.useRef(false);
  const renderedFieldsRef = React.useRef<ReadonlySet<string>>(new Set());
  const submittedRef = React.useRef<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);
  const unlock = React.useCallback(() => {
    lockRef.current = false;
    setIsSubmitting(false);
  }, []);
  // Shown again (Back under `cacheComponents`) or still mounted on a new path: take input again.
  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new pathname is the trigger.
  React.useEffect(() => unlock(), [unlock, pathname]);
  const serverAction: ServerAction = React.useCallback(
    async (_prev, formData) => {
      const submission = parseWithZod(formData, { schema });
      if (submission.status !== "success") {
        unlock();
        return submission.reply({ resetForm: false });
      }
      const res = await postForm(action, formData, labels);
      if (!res.ok) {
        unlock();
        return buildSubmissionReply(submission, res, labels.formError, renderedFieldsRef.current);
      }
      if (successMessage) toast.success(successMessage);
      setSaved(submittedRef.current);
      if (!redirectTo) {
        unlock();
        return submission.reply();
      }
      const target = redirectWithCreatedKey(redirectTo, res.createdKey);
      router.push(target);
      // A form that is leaving stays locked; one the redirect keeps on screen takes input again.
      if (new URL(target, window.location.href).pathname === window.location.pathname) unlock();
      return submission.reply();
    },
    [action, schema, redirectTo, router, labels, successMessage, toast, unlock],
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
  const unsaved = form.dirty && saved !== JSON.stringify(form.value);
  const leaveGuard = useLeaveGuard(unsaved && !isSubmitting);

  const ctxValue = React.useMemo<FormContextValue>(
    () => ({
      form,
      fields: fields as unknown as Record<string, FieldMetadata<unknown>>,
      isSubmitting,
    }),
    [form, fields, isSubmitting],
  );

  const formProps = getFormProps(form);
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (lockRef.current) {
      event.preventDefault();
      return;
    }
    formProps.onSubmit(event);
    if (event.defaultPrevented || isIntent(event.nativeEvent)) return;
    renderedFieldsRef.current = fieldNamesOf(event.currentTarget);
    submittedRef.current = JSON.stringify(form.value);
    lockRef.current = true;
    setIsSubmitting(true);
  };
  return (
    <FormActionDispatchContext.Provider value={formAction}>
      <FormCtx.Provider value={ctxValue}>
        <form
          {...formProps}
          onSubmit={onSubmit}
          action={formAction}
          onReset={keepAfterAction}
          aria-busy={isSubmitting || undefined}
          className={cn("fp-space-y-4", className)}
        >
          {children}
        </form>
        {leaveGuard}
      </FormCtx.Provider>
    </FormActionDispatchContext.Provider>
  );
}

/** conform's own validate and reset requests submit the form through a named button. */
function isIntent(event: Event): boolean {
  const submitter = "submitter" in event ? event.submitter : null;
  return submitter instanceof Element && submitter.getAttribute("name") === "__intent__";
}

function fieldNamesOf(form: HTMLFormElement): ReadonlySet<string> {
  const names = new Set<string>();
  for (const element of Array.from(form.elements)) {
    const name = element.getAttribute("name");
    if (name) names.add(name);
  }
  return names;
}

async function postForm(
  action: string,
  formData: FormData,
  labels: ResolvedLabels,
): Promise<FormActionResult> {
  let response: Response;
  try {
    response = await fetch(action, { method: "POST", body: formData });
  } catch {
    return { ok: false, error: connectionMessage(labels.errors) };
  }
  const body = (await response.json().catch(() => ({}))) as Partial<FormActionResult>;
  // A non-2xx response is always a failure; `ok` must be assigned after the spread to win over the body.
  return { ...body, ok: response.ok ? (body.ok ?? true) : false };
}

/**
 * React resets a form after its action settles, and conform clears its errors on that reset; in
 * `next dev` the reset lands after the server's errors render. The form has no reset button, so keep both.
 */
function keepAfterAction(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

/**
 * Turn the JSON `{ ok, error?, fieldErrors? }` response into a conform SubmissionResult. A field
 * error the form renders shows under its field only; one it does not render goes to the banner.
 */
export function buildSubmissionReply(
  submission: { reply: (options?: ReplyShapeOptions) => SubmissionResult<string[]> },
  res: FormActionResult,
  genericMessage: string = DEFAULT_LABELS.formError,
  renderedFields?: ReadonlySet<string>,
): SubmissionResult<string[]> {
  if (res.ok) return submission.reply();
  const fieldErrors = Object.entries(res.fieldErrors ?? {});
  if (fieldErrors.length === 0) {
    return submission.reply({ formErrors: [res.error ?? genericMessage] });
  }
  const unplaced = renderedFields
    ? fieldErrors.filter(([name]) => !renderedFields.has(name)).map(([, message]) => message)
    : [];
  return submission.reply({
    ...(unplaced.length > 0 ? { formErrors: [unplaced.join(" ")] } : {}),
    fieldErrors: Object.fromEntries(fieldErrors.map(([name, message]) => [name, [message]])),
  });
}

interface ReplyShapeOptions {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
}
