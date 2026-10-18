"use client";
import type * as React from "react";
import { ChunkBoundary } from "./chunk-boundary";
import { lazyRetry } from "./lazy-retry";

/** A component whose code loads the first time a page renders it; the nearest `Suspense` waits for it. */
export function lazyPart<P extends object>(
  load: () => Promise<React.ComponentType<P>>,
): (props: P) => React.ReactNode {
  const Loaded = lazyRetry<P>(() => load().then((component) => ({ default: component })));
  return function LazyPart(props: P) {
    return (
      <ChunkBoundary>
        <Loaded {...props} />
      </ChunkBoundary>
    );
  };
}
