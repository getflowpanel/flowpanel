"use client";
import { majorUnitsInput, moneyMinorUnits } from "@flowpanel/core/format";
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
  humanize,
  StandaloneFormFields,
  useFormatting,
  useLabels,
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
  const labels = useLabels();
  const formatting = useFormatting();
  const [fieldErrors, setFieldErrors] = React.useState<ActionFormFieldErrors | null>(null);
  const [pending, setPending] = React.useState(false);
  const names = React.useMemo(() => fields.map((f) => f.name), [fields]);
  const defaults = React.useMemo(() => {
    const separator =
      new Intl.NumberFormat(formatting.locale)
        .formatToParts(1.1)
        .find((part) => part.type === "decimal")?.value ?? ".";
    // A money default is in stored units, as on a resource form, so the control shows major units.
    const shown = (f: ActionFormField) =>
      f.type === "money"
        ? majorUnitsInput(f.defaultValue, {
            minorUnits: moneyMinorUnits(f.minorUnits, f.currency ?? formatting.currency),
            storage: f.storage ?? "minor",
            decimalSeparator: separator,
          })
        : f.defaultValue;
    return Object.fromEntries(
      fields.flatMap((f) => {
        const start = shown(f);
        return start === undefined ? [] : [[f.name, start]];
      }),
    );
  }, [fields, formatting]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = readFormValues(
      fields.map((f) =>
        f.type === "money"
          ? { ...f, minorUnits: moneyMinorUnits(f.minorUnits, f.currency ?? formatting.currency) }
          : f,
      ),
      new FormData(e.currentTarget),
    );
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
          <div className="fp-my-4 fp-grid fp-gap-4">
            {formBannerError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="fp-rounded-sm fp-border fp-border-err/30 fp-bg-err/10 fp-px-3 fp-py-2 fp-text-sm fp-text-err"
              >
                {formBannerError}
              </div>
            ) : null}
            <StandaloneFormFields
              formId={formId}
              names={names}
              defaults={defaults}
              {...(fieldErrors ? { errors: fieldErrors } : {})}
            >
              {fields.map((f) => (
                <FormField
                  key={f.name}
                  name={f.name}
                  label={f.label ?? humanize(f.name)}
                  type={(f.type ?? "text") as NonNullable<FormFieldProps["type"]>}
                  {...(f.help ? { help: f.help } : {})}
                  {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                  {...(f.required ? { required: true } : {})}
                  {...(f.options ? { options: f.options } : {})}
                  {...(f.currency ? { currency: f.currency } : {})}
                />
              ))}
            </StandaloneFormFields>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              {labels.actions.cancel}
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
