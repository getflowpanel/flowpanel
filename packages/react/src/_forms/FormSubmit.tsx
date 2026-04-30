"use client";
import { Button, type ButtonProps } from "../ui/button.js";
import { useFormContext } from "./Form.js";

export function FormSubmit(props: ButtonProps) {
  const { form } = useFormContext();
  return <Button type="submit" disabled={form.valid === false} {...props} />;
}
