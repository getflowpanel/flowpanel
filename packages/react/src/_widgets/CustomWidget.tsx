import type { ComponentType, JSX } from "react";
import { Card } from "../_layout/Card.js";

export interface CustomWidgetProps<P> {
  Component: ComponentType<P>;
  props: P;
  frame?: boolean;
}

/**
 * @deprecated Do not use from a Server Component path. Because
 * `@flowpanel/react` is bundled with `"use client"` at the top of its ESM
 * entry, importing this component into an RSC render path turns it into a
 * client component, and passing `Component` (a function) as a prop fails
 * RSC serialization with "Functions cannot be passed directly to Client
 * Components". The framework now server-renders custom widgets directly
 * in `@flowpanel/next` (`runtime/render-widget.tsx`).
 *
 * Kept for direct client-side consumers and tests that already operate
 * in a client context.
 */
export function CustomWidget<P>({ Component, props, frame = false }: CustomWidgetProps<P>) {
  const el = <Component {...(props as P & JSX.IntrinsicAttributes)} />;
  return frame ? (
    <Card>
      <div className="p-4">{el}</div>
    </Card>
  ) : (
    el
  );
}
