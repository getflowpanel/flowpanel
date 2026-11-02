"use client";
import type * as React from "react";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";
import { Button, type ButtonProps } from "../ui/button";
import { useFormContext, useFormReady } from "./form-context";

/** Stays enabled while the form has errors: submitting again moves focus to the first one. */
export function FormSubmit({ className, ...props }: ButtonProps) {
  const { isSubmitting } = useFormContext();
  const ready = useFormReady();
  return (
    <Button
      type="submit"
      disabled={!ready}
      aria-disabled={isSubmitting || undefined}
      aria-busy={isSubmitting || undefined}
      className={cn(isSubmitting && "fp-cursor-progress fp-opacity-60", className)}
      {...props}
    />
  );
}

/** A form's fields, which take no focus or input until its code runs; the actions row stays outside, readable. */
export function FormFields({ children }: { children: React.ReactNode }) {
  const ready = useFormReady();
  return (
    <div
      className="fp-space-y-4"
      data-fp-form-fields=""
      aria-busy={!ready || undefined}
      inert={!ready || undefined}
      data-fp-loading={ready ? undefined : ""}
    >
      {children}
    </div>
  );
}

/** "Loading form…" beside the submit while a server-rendered form waits for its code; it shows only once the wait is noticeable. */
export function FormLoadingNote() {
  const ready = useFormReady();
  const { form } = useLabels();
  if (ready) return null;
  return (
    <span role="status" className="fp-form-loading-note fp-text-sm fp-text-soft">
      {form.loading}
    </span>
  );
}
