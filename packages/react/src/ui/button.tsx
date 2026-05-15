"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultButton, buttonVariants, type ButtonProps } from "./buttonDefault.js";

/**
 * Renders whatever override the user registered via theme.components.Button,
 * falling back to DefaultButton.
 *
 * Note: if you provide a custom Button override, it SHOULD also be
 * React.forwardRef-aware to avoid the warning Radix emits when using asChild.
 */
export const Button = React.forwardRef<HTMLButtonElement, import("./buttonDefault.js").ButtonProps>(
  (props, ref) => {
    const Slot = useComponents().Button as React.ForwardRefExoticComponent<
      import("./buttonDefault.js").ButtonProps & React.RefAttributes<HTMLButtonElement>
    >;
    return <Slot {...props} ref={ref} />;
  },
);
Button.displayName = "Button";
