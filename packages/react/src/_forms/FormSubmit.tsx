"use client";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "../ui/button.js";
import { useFormContext } from "./Form.js";

export function FormSubmit(props: ButtonProps) {
  const { form } = useFormContext();
  const { pending } = useFormStatus();
  const { disabled, ...rest } = props;
  return (
    <Button
      type="submit"
      disabled={disabled || pending || form.valid === false}
      aria-busy={pending || undefined}
      {...rest}
    />
  );
}
