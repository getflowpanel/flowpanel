"use client";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "../ui/button";
import { useFormContext } from "./Form";

/** Stays enabled while the form has errors: submitting again moves focus to the first one. */
export function FormSubmit({ className, ...props }: ButtonProps) {
  const { isSubmitting } = useFormContext();
  return (
    <Button
      type="submit"
      aria-disabled={isSubmitting || undefined}
      aria-busy={isSubmitting || undefined}
      className={cn(isSubmitting && "fp-cursor-progress fp-opacity-60", className)}
      {...props}
    />
  );
}
