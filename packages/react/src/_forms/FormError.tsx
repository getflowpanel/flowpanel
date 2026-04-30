"use client";
import { useFormContext } from "./Form.js";

export function FormError() {
  const { form } = useFormContext();
  if (!form.errors || form.errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-fp-sm border border-fp-err/30 bg-fp-err/10 px-3 py-2 text-sm text-fp-err"
    >
      {form.errors[0]}
    </div>
  );
}
