"use client";
import { useLabels } from "@flowpanel/react";
import type * as React from "react";
import { WidgetErrorBoundary } from "../runtime/WidgetErrorBoundary";
import { lazyRetry, retryFailedParts } from "./lazy-retry";

/** A page part whose code loads the first time a page renders it; a part that cannot load shows a card, not a crash. */
export function lazyPart<P extends object>(
  load: () => Promise<React.ComponentType<P>>,
): (props: P) => React.ReactNode {
  const Loaded = lazyRetry<P>(() => load().then((component) => ({ default: component })));
  return function LazyPart(props: P) {
    const { errors } = useLabels();
    return (
      <WidgetErrorBoundary plain failureTitle={errors.title} onRetry={retryFailedParts}>
        <Loaded {...props} />
      </WidgetErrorBoundary>
    );
  };
}
