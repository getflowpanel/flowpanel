import type { ComponentType, JSX } from "react";
import { Card } from "../_layout/Card.js";

export interface CustomWidgetProps<P> {
  Component: ComponentType<P>;
  props: P;
  frame?: boolean;
}

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
