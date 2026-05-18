"use client";
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
import type { ButtonProps } from "./buttonDefault.js";

export { DefaultButton, buttonVariants, type ButtonProps } from "./buttonDefault.js";

/**
 * Renders whatever override the user registered via theme.components.Button,
 * falling back to DefaultButton.
 *
 * Note: if you provide a custom Button override, it SHOULD also be
 * forwardRef-aware to avoid the warning Radix emits when using asChild.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const Slot = useComponents().Button as ForwardRefExoticComponent<
    ButtonProps & RefAttributes<HTMLButtonElement>
  >;
  return <Slot {...props} ref={ref} />;
});
Button.displayName = "Button";
