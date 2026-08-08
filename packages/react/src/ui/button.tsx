"use client";
import { type ForwardRefExoticComponent, forwardRef, type RefAttributes } from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { type ButtonProps, DefaultButton } from "./buttonDefault.js";

export { type ButtonProps, buttonVariants, DefaultButton } from "./buttonDefault.js";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const Slot = useComponent("Button", DefaultButton) as ForwardRefExoticComponent<
    ButtonProps & RefAttributes<HTMLButtonElement>
  >;
  return <Slot {...props} ref={ref} />;
});
Button.displayName = "Button";
