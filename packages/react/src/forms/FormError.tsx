"use client";
import { useFormContext } from "./form-context";

export function FormError() {
  const { form } = useFormContext();
  if (!form.errors || form.errors.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fp-rounded-sm fp-border fp-border-err/30 fp-bg-err/10 fp-px-3 fp-py-2 fp-text-sm fp-text-err-ink"
    >
      {form.errors[0]}
    </div>
  );
}
