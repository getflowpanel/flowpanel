"use client";
import { type ForwardRefExoticComponent, forwardRef, type RefAttributes } from "react";
import { useComponent } from "../provider/ComponentsContext";
import { type ButtonProps, DefaultButton } from "./button-default";

export { type ButtonProps, buttonVariants, DefaultButton } from "./button-default";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const Slot = useComponent("Button", DefaultButton) as ForwardRefExoticComponent<
    ButtonProps & RefAttributes<HTMLButtonElement>
  >;
  return <Slot {...props} ref={ref} />;
});
Button.displayName = "Button";
