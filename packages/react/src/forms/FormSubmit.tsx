"use client";
import { cn } from "../lib/cn";
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
