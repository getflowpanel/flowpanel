"use client";
import { Button, type ButtonProps } from "../ui/button.js";
import { useFormContext } from "./Form.js";

export function FormSubmit(props: ButtonProps) {
  const { form, isSubmitting } = useFormContext();
  const { disabled, ...rest } = props;
  return (
    <Button
      type="submit"
      disabled={disabled || isSubmitting || form.valid === false}
      aria-busy={isSubmitting || undefined}
      {...rest}
    />
  );
}
