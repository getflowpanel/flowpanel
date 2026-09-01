"use client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  type FormFieldProps,
  StandaloneFormFields,
} from "@flowpanel/react";
import * as React from "react";
import type { ActionFormField, ActionFormFieldErrors } from "./action-form-field";
import { readFormValues } from "./form-values";

export interface ActionFormDialogProps {
  /** Dialog title — typically `action.confirm?.title ?? action.label`. */
  title: string;
  description?: string;
  /** Submit button label — typically `action.confirm?.confirmLabel ?? action.label`. */
  submitLabel: string;
  variant?: "default" | "destructive";
  fields: ActionFormField[];
  onCancel: () => void;
  /** Runs the action. */
  onSubmit: (input: Record<string, unknown>) => Promise<ActionFormFieldErrors | null | undefined>;
}

/** Shared modal form for row / bulk / dashboard / drawer actions that declare `form: [...]`. */
export function ActionFormDialog({
  title,
  description,
  submitLabel,
  variant,
  fields,
  onCancel,
  onSubmit,
}: ActionFormDialogProps) {
  const formId = React.useId();
  const [fieldErrors, setFieldErrors] = React.useState<ActionFormFieldErrors | null>(null);
  const [pending, setPending] = React.useState(false);
  const names = React.useMemo(() => fields.map((f) => f.name), [fields]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = readFormValues(fields, new FormData(e.currentTarget));
    setPending(true);
    try {
      const errors = await onSubmit(input);
      setFieldErrors(errors ?? null);
    } finally {
      setPending(false);
    }
  }

  const formBannerError = fieldErrors?.[""];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent {...(description ? {} : { "aria-describedby": undefined })}>
        <form id={formId} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="my-4 grid gap-4">
            {formBannerError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-fp-sm border border-fp-err/30 bg-fp-err/10 px-3 py-2 text-sm text-fp-err"
              >
                {formBannerError}
              </div>
            ) : null}
            <StandaloneFormFields
              formId={formId}
              names={names}
              {...(fieldErrors ? { errors: fieldErrors } : {})}
            >
              {fields.map((f) => (
                <FormField
                  key={f.name}
                  name={f.name}
                  label={f.label ?? f.name}
                  type={(f.type ?? "text") as NonNullable<FormFieldProps["type"]>}
                  {...(f.help ? { help: f.help } : {})}
                  {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                  {...(f.required ? { required: true } : {})}
                  {...(f.options ? { options: f.options } : {})}
                />
              ))}
            </StandaloneFormFields>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? "…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
